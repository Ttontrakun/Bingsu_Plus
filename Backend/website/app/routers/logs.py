"""
Log streaming routes for realtime log viewing
"""
import asyncio
import logging
import sys
import queue
import threading
from datetime import datetime
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
import json

router = APIRouter(prefix="/logs", tags=["logs"])

# Setup logger
logger = logging.getLogger("app")
logger.setLevel(logging.INFO)

# Create console handler if not exists
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    )
    logger.addHandler(handler)


class LogStream:
    """Log stream handler that captures logs and streams them"""
    def __init__(self):
        self.log_queue = asyncio.Queue()
        self.sync_queue = queue.Queue()  # Thread-safe queue for sync logging
        self.clients = set()
        self._background_task = None
        self._start_background_processor()
    
    def _start_background_processor(self):
        """Start background thread to process sync queue"""
        def process_queue():
            # Create new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            async def process():
                while True:
                    try:
                        # Get from sync queue (non-blocking)
                        try:
                            log_entry = self.sync_queue.get_nowait()
                            # Put into async queue
                            await self.log_queue.put(log_entry)
                        except queue.Empty:
                            await asyncio.sleep(0.1)
                    except Exception as e:
                        # Silently ignore errors to prevent recursion
                        pass
            
            try:
                loop.run_until_complete(process())
            except Exception:
                pass
        
        thread = threading.Thread(target=process_queue, daemon=True)
        thread.start()
    
    def add_log_sync(self, level: str, message: str, source: str = "app"):
        """Add a log entry synchronously (thread-safe)"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "message": message,
            "source": source
        }
        try:
            self.sync_queue.put_nowait(log_entry)
        except Exception:
            pass  # Ignore if queue is full
    
    async def add_log(self, level: str, message: str, source: str = "app"):
        """Add a log entry to the stream"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "message": message,
            "source": source
        }
        await self.log_queue.put(log_entry)
    
    async def stream_logs(self) -> AsyncGenerator[str, None]:
        """Stream logs as Server-Sent Events"""
        try:
            while True:
                # Wait for log entry with timeout
                try:
                    log_entry = await asyncio.wait_for(self.log_queue.get(), timeout=1.0)
                    # Format as SSE
                    data = json.dumps(log_entry)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    # Send heartbeat to keep connection alive
                    yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass


# Global log stream instance
log_stream = LogStream()


# Custom log handler that sends logs to stream
class StreamLogHandler(logging.Handler):
    """Log handler that sends logs to the stream (thread-safe)"""
    def emit(self, record):
        try:
            # Format message
            message = self.format(record)
            level = record.levelname
            source = record.name
            
            # Use thread-safe sync method
            log_stream.add_log_sync(level=level, message=message, source=source)
        except Exception:
            # Ignore errors in log handler to prevent recursion
            pass


# Add stream handler to root logger and app logger
stream_handler = StreamLogHandler()
stream_handler.setFormatter(
    logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
)

# Add to root logger to capture all logs
root_logger = logging.getLogger()
# Remove existing handlers to avoid duplicates
if not any(isinstance(h, StreamLogHandler) for h in root_logger.handlers):
    root_logger.addHandler(stream_handler)
root_logger.setLevel(logging.INFO)

# Also add to app logger
if not any(isinstance(h, StreamLogHandler) for h in logger.handlers):
    logger.addHandler(stream_handler)


@router.get("/stream")
async def stream_logs():
    """Stream logs in realtime using Server-Sent Events"""
    async def event_generator() -> AsyncGenerator[str, None]:
        async for log in log_stream.stream_logs():
            yield log
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/test")
async def test_log(message: str = "Test log message"):
    """Generate a test log entry"""
    logger.info(f"Test log: {message}")
    await log_stream.add_log("INFO", message, "test")
    return {"message": "Log entry created", "log": message}


@router.get("/recent")
async def get_recent_logs(limit: int = 100):
    """Get recent log entries (not realtime, just recent logs)"""
    # This is a simple implementation
    # In production, you might want to store logs in a database
    return {
        "message": "Recent logs endpoint",
        "note": "Use /logs/stream for realtime logs",
        "limit": limit
    }
