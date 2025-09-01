package db.collections;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.function.BiConsumer;
import java.util.function.Function;

/**
 * A generic, thread-safe hash map using separate chaining with singly linked lists,
 * striped read/write locks for high concurrency, and a global table read/write lock
 * to coordinate safe resizing.
 *
 * This class is designed as a foundational storage structure for a custom database engine.
 *
 * Concurrency model:
 * - All public operations acquire a global table read lock, allowing concurrent access.
 * - Mutations on a bucket acquire that bucket's stripe write lock; reads acquire stripe read lock.
 * - Resizing acquires the global table write lock, blocking all operations until complete.
 *
 * Notes:
 * - Null keys are not allowed. Values may be null.
 * - Capacity is always a power of two to allow fast index masking.
 */
public class StripedHashMap<K, V> {

    private static final int DEFAULT_INITIAL_CAPACITY = 16;
    private static final int DEFAULT_NUM_STRIPES = 16;
    private static final float DEFAULT_LOAD_FACTOR = 0.75f;

    private volatile Node<K, V>[] table;
    private final ReadWriteLock tableLock;
    private final ReadWriteLock[] stripeLocks;
    private final int numStripes;
    private final float loadFactor;
    private final AtomicInteger size;

    @SuppressWarnings("unchecked")
    public StripedHashMap() {
        this(DEFAULT_INITIAL_CAPACITY, DEFAULT_LOAD_FACTOR, DEFAULT_NUM_STRIPES);
    }

    @SuppressWarnings("unchecked")
    public StripedHashMap(int initialCapacity, float loadFactor, int numStripes) {
        if (initialCapacity <= 0) throw new IllegalArgumentException("initialCapacity must be > 0");
        if (loadFactor <= 0.0f || Float.isNaN(loadFactor)) throw new IllegalArgumentException("loadFactor must be > 0");
        if (numStripes <= 0) throw new IllegalArgumentException("numStripes must be > 0");

        int capacity = roundUpToPowerOfTwo(initialCapacity);
        this.loadFactor = loadFactor;
        this.numStripes = Integer.highestOneBit(numStripes) == numStripes ? numStripes : roundUpToPowerOfTwo(numStripes);
        this.table = (Node<K, V>[]) new Node[capacity];
        this.tableLock = new ReentrantReadWriteLock();
        this.stripeLocks = new ReadWriteLock[this.numStripes];
        for (int i = 0; i < this.numStripes; i++) {
            this.stripeLocks[i] = new ReentrantReadWriteLock();
        }
        this.size = new AtomicInteger(0);
    }

    /** Inserts or replaces the value for key. Returns the previous value or null if none. */
    public V put(K key, V value) {
        Objects.requireNonNull(key, "key must not be null");
        tableLock.readLock().lock();
        try {
            Node<K, V>[] currentTable = table;
            int hash = spread(key.hashCode());
            int index = indexFor(hash, currentTable.length);
            int stripe = stripeFor(hash);
            ReadWriteLock bucketLock = stripeLocks[stripe];
            bucketLock.writeLock().lock();
            try {
                Node<K, V> head = currentTable[index];
                for (Node<K, V> node = head; node != null; node = node.next) {
                    if (node.hash == hash && Objects.equals(node.key, key)) {
                        V old = node.value;
                        node.value = value;
                        return old;
                    }
                }
                Node<K, V> newHead = new Node<>(hash, key, value, head);
                currentTable[index] = newHead;
                int newSize = size.incrementAndGet();
                if (needsResize(currentTable.length, newSize)) {
                    // Release bucket lock before resize to avoid lock order inversions; resize uses table write lock.
                    bucketLock.writeLock().unlock();
                    // Important: downgrade path handled by try/finally after resize; return path below ensures we don't unlock twice.
                    resizeIfNeeded();
                    // Re-acquire stripe lock to preserve method's lock pairing before returning
                    bucketLock.writeLock().lock();
                }
                return null;
            } finally {
                bucketLock.writeLock().unlock();
            }
        } finally {
            tableLock.readLock().unlock();
        }
    }

    /** Returns the value for key or null if not present. */
    public V get(K key) {
        Objects.requireNonNull(key, "key must not be null");
        tableLock.readLock().lock();
        try {
            Node<K, V>[] currentTable = table;
            int hash = spread(key.hashCode());
            int index = indexFor(hash, currentTable.length);
            int stripe = stripeFor(hash);
            ReadWriteLock bucketLock = stripeLocks[stripe];
            bucketLock.readLock().lock();
            try {
                for (Node<K, V> node = currentTable[index]; node != null; node = node.next) {
                    if (node.hash == hash && Objects.equals(node.key, key)) {
                        return node.value;
                    }
                }
                return null;
            } finally {
                bucketLock.readLock().unlock();
            }
        } finally {
            tableLock.readLock().unlock();
        }
    }

    /** Removes mapping for key and returns previous value or null if absent. */
    public V remove(K key) {
        Objects.requireNonNull(key, "key must not be null");
        tableLock.readLock().lock();
        try {
            Node<K, V>[] currentTable = table;
            int hash = spread(key.hashCode());
            int index = indexFor(hash, currentTable.length);
            int stripe = stripeFor(hash);
            ReadWriteLock bucketLock = stripeLocks[stripe];
            bucketLock.writeLock().lock();
            try {
                Node<K, V> prev = null;
                for (Node<K, V> node = currentTable[index]; node != null; node = node.next) {
                    if (node.hash == hash && Objects.equals(node.key, key)) {
                        V old = node.value;
                        if (prev == null) {
                            currentTable[index] = node.next;
                        } else {
                            prev.next = node.next;
                        }
                        size.decrementAndGet();
                        return old;
                    }
                    prev = node;
                }
                return null;
            } finally {
                bucketLock.writeLock().unlock();
            }
        } finally {
            tableLock.readLock().unlock();
        }
    }

    public boolean containsKey(K key) {
        return get(key) != null;
    }

    public int size() {
        return size.get();
    }

    public void clear() {
        tableLock.writeLock().lock();
        try {
            Node<K, V>[] currentTable = table;
            for (int i = 0; i < currentTable.length; i++) {
                currentTable[i] = null;
            }
            size.set(0);
        } finally {
            tableLock.writeLock().unlock();
        }
    }

    public V putIfAbsent(K key, V value) {
        Objects.requireNonNull(key, "key must not be null");
        tableLock.readLock().lock();
        try {
            Node<K, V>[] currentTable = table;
            int hash = spread(key.hashCode());
            int index = indexFor(hash, currentTable.length);
            int stripe = stripeFor(hash);
            ReadWriteLock bucketLock = stripeLocks[stripe];
            bucketLock.writeLock().lock();
            try {
                for (Node<K, V> node = currentTable[index]; node != null; node = node.next) {
                    if (node.hash == hash && Objects.equals(node.key, key)) {
                        return node.value;
                    }
                }
                Node<K, V> newHead = new Node<>(hash, key, value, currentTable[index]);
                currentTable[index] = newHead;
                int newSize = size.incrementAndGet();
                if (needsResize(currentTable.length, newSize)) {
                    bucketLock.writeLock().unlock();
                    resizeIfNeeded();
                    bucketLock.writeLock().lock();
                }
                return null;
            } finally {
                bucketLock.writeLock().unlock();
            }
        } finally {
            tableLock.readLock().unlock();
        }
    }

    public boolean replace(K key, V oldValue, V newValue) {
        Objects.requireNonNull(key, "key must not be null");
        tableLock.readLock().lock();
        try {
            Node<K, V>[] currentTable = table;
            int hash = spread(key.hashCode());
            int index = indexFor(hash, currentTable.length);
            int stripe = stripeFor(hash);
            ReadWriteLock bucketLock = stripeLocks[stripe];
            bucketLock.writeLock().lock();
            try {
                for (Node<K, V> node = currentTable[index]; node != null; node = node.next) {
                    if (node.hash == hash && Objects.equals(node.key, key)) {
                        if (Objects.equals(node.value, oldValue)) {
                            node.value = newValue;
                            return true;
                        }
                        return false;
                    }
                }
                return false;
            } finally {
                bucketLock.writeLock().unlock();
            }
        } finally {
            tableLock.readLock().unlock();
        }
    }

    public V computeIfAbsent(K key, Function<? super K, ? extends V> mappingFunction) {
        Objects.requireNonNull(key, "key must not be null");
        Objects.requireNonNull(mappingFunction, "mappingFunction must not be null");
        tableLock.readLock().lock();
        try {
            Node<K, V>[] currentTable = table;
            int hash = spread(key.hashCode());
            int index = indexFor(hash, currentTable.length);
            int stripe = stripeFor(hash);
            ReadWriteLock bucketLock = stripeLocks[stripe];
            bucketLock.writeLock().lock();
            try {
                for (Node<K, V> node = currentTable[index]; node != null; node = node.next) {
                    if (node.hash == hash && Objects.equals(node.key, key)) {
                        return node.value;
                    }
                }
                V newValue = mappingFunction.apply(key);
                Node<K, V> newHead = new Node<>(hash, key, newValue, currentTable[index]);
                currentTable[index] = newHead;
                int newSize = size.incrementAndGet();
                if (needsResize(currentTable.length, newSize)) {
                    bucketLock.writeLock().unlock();
                    resizeIfNeeded();
                    bucketLock.writeLock().lock();
                }
                return newValue;
            } finally {
                bucketLock.writeLock().unlock();
            }
        } finally {
            tableLock.readLock().unlock();
        }
    }

    public void forEach(BiConsumer<? super K, ? super V> action) {
        Objects.requireNonNull(action, "action must not be null");
        tableLock.readLock().lock();
        try {
            Node<K, V>[] currentTable = table;
            // Iterate stripe by stripe to allow some concurrency with writers on other stripes
            for (int stripe = 0; stripe < numStripes; stripe++) {
                ReadWriteLock bucketLock = stripeLocks[stripe];
                bucketLock.readLock().lock();
                try {
                    for (int index = stripe; index < currentTable.length; index += numStripes) {
                        for (Node<K, V> node = currentTable[index]; node != null; node = node.next) {
                            action.accept(node.key, node.value);
                        }
                    }
                } finally {
                    bucketLock.readLock().unlock();
                }
            }
        } finally {
            tableLock.readLock().unlock();
        }
    }

    private boolean needsResize(int capacity, int currentSize) {
        return currentSize > (int) (capacity * loadFactor);
    }

    @SuppressWarnings("unchecked")
    private void resizeIfNeeded() {
        // First check under table read lock if still needed; then upgrade to write (by releasing and reacquiring).
        tableLock.readLock().unlock();
        tableLock.writeLock().lock();
        try {
            Node<K, V>[] current = table;
            if (!needsResize(current.length, size.get())) {
                return; // Another thread already resized.
            }
            int newCapacity = current.length << 1;
            Node<K, V>[] newTable = (Node<K, V>[]) new Node[newCapacity];
            // We do not need stripe locks here; table write lock excludes readers/writers.
            for (Node<K, V> bucketHead : current) {
                for (Node<K, V> node = bucketHead; node != null; node = node.next) {
                    int newIndex = indexFor(node.hash, newCapacity);
                    newTable[newIndex] = new Node<>(node.hash, node.key, node.value, newTable[newIndex]);
                }
            }
            table = newTable;
        } finally {
            // Downgrade: acquire read lock before releasing write, so caller's finally blocks expecting a read lock can proceed safely.
            tableLock.readLock().lock();
            tableLock.writeLock().unlock();
        }
    }

    private static int roundUpToPowerOfTwo(int value) {
        int highest = Integer.highestOneBit(value - 1) << 1;
        return Math.max(2, highest);
    }

    private static int spread(int h) {
        // Spread bits similar to JDK's HashMap to reduce collisions
        return h ^ (h >>> 16);
    }

    private static int indexFor(int hash, int length) {
        return hash & (length - 1);
    }

    private int stripeFor(int hash) {
        return hash & (numStripes - 1);
    }

    private static final class Node<K, V> {
        final int hash;
        final K key;
        volatile V value;
        Node<K, V> next;

        Node(int hash, K key, V value, Node<K, V> next) {
            this.hash = hash;
            this.key = key;
            this.value = value;
            this.next = next;
        }
    }
}


