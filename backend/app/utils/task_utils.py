"""
Utility functions for task management to eliminate code duplication
across different endpoints.
"""
from fastapi import HTTPException
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

def get_task_by_id(queue, task_id: str) -> Dict[str, Any]:
    """
    Get task by ID from queue and validate its existence
    
    Args:
        queue: JobQueue instance
        task_id: ID of the task to retrieve
        
    Returns:
        Task data dictionary
        
    Raises:
        HTTPException: When task is not found or in incorrect status
    """
    # Get all tasks from queue
    tasks = queue.get_all_tasks()
    task = next((t for t in tasks if t.get("task_id") == task_id), None)
    
    if not task:
        logger.error(f"Task with ID {task_id} not found")
        raise HTTPException(status_code=404, detail=f"Task with ID {task_id} not found")
    
    return task

def validate_completed_task(task: Dict[str, Any], task_id: str) -> Dict[str, Any]:
    """
    Validate that task is completed and has results
    
    Args:
        task: Task data dictionary
        task_id: ID of the task
        
    Returns:
        Task result dictionary
        
    Raises:
        HTTPException: When task is not completed or has no results
    """
    if task["status"] != "completed":
        logger.warning(f"Task with ID {task_id} is not completed yet (status: {task['status']})")
        raise HTTPException(status_code=400, 
                          detail=f"Task with ID {task_id} is not completed yet (status: {task['status']})")
    
    if "result" not in task or not task["result"]:
        logger.error(f"Results for task with ID {task_id} are missing")
        raise HTTPException(status_code=500, 
                          detail=f"Results for task with ID {task_id} are missing")
    
    return task["result"]

def export_to_format(data: Dict[str, Any], format: str, filename_prefix: str, task_id: str):
    """
    Export data to specified format (JSON, CSV, Excel)
    
    Args:
        data: Data to export
        format: Export format ('json', 'csv', 'excel')
        filename_prefix: Prefix for the output filename
        task_id: Task ID to include in filename
        
    Returns:
        Response with exported data in requested format
        
    Raises:
        HTTPException: When format is not supported
    """
    try:
        if format == "json":
            # Return JSON directly
            return data
        elif format == "csv":
            # Convert to CSV
            import pandas as pd
            from fastapi.responses import StreamingResponse
            import io
            
            # Convert to DataFrame
            df = pd.DataFrame(data)
            
            # Save to buffer
            buffer = io.StringIO()
            df.to_csv(buffer, index=False)
            buffer.seek(0)
            
            # Return CSV response
            return StreamingResponse(
                buffer,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={filename_prefix}_{task_id}.csv"}
            )
        elif format == "excel":
            # Convert to Excel
            import pandas as pd
            from fastapi.responses import StreamingResponse
            import io
            
            # Convert to DataFrame
            df = pd.DataFrame(data)
            
            # Save to buffer
            buffer = io.BytesIO()
            df.to_excel(buffer, index=False)
            buffer.seek(0)
            
            # Return Excel response
            return StreamingResponse(
                buffer,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename_prefix}_{task_id}.xlsx"}
            )
        else:
            logger.error(f"Unsupported format: {format}")
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")
    except Exception as e:
        logger.error(f"Error exporting data to {format}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error exporting data to {format}: {str(e)}")