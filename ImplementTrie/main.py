from fastapi import FastAPI
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from routes import router


app = FastAPI(title="IP Routing Table (Radix Trie)")
app.include_router(router)

# Serve static files and the UI
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
def root():
    return FileResponse("static/index.html")


