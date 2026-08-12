from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Force, Mech, Elemental

router = APIRouter(prefix="/api")

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}

_ENTITY_MODELS = {"forces": Force, "mechs": Mech, "elementals": Elemental}


async def _get_entity(kind, entity_id, session):
    entity = await session.get(_ENTITY_MODELS[kind], entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail=f"{kind[:-1].capitalize()} not found")
    return entity


async def _upload_image(kind, entity_id, file, session):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type - use PNG, JPEG, WEBP or GIF")
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    entity = await _get_entity(kind, entity_id, session)
    entity.image_data = data
    entity.image_mime_type = file.content_type
    await session.commit()
    return {"image": f"/api/{kind}/{entity_id}/image"}


async def _get_image(kind, entity_id, session):
    entity = await _get_entity(kind, entity_id, session)
    if not entity.image_data:
        raise HTTPException(status_code=404, detail="No image set")
    return Response(content=entity.image_data, media_type=entity.image_mime_type or "application/octet-stream")


async def _delete_image(kind, entity_id, session):
    entity = await _get_entity(kind, entity_id, session)
    entity.image_data = None
    entity.image_mime_type = None
    await session.commit()
    return Response(status_code=204)


def _register_image_routes(kind: str):
    @router.post(f"/{kind}/{{entity_id}}/image")
    async def upload_image(entity_id: str, file: UploadFile = File(...), session: AsyncSession = Depends(get_session)):
        return await _upload_image(kind, entity_id, file, session)

    @router.get(f"/{kind}/{{entity_id}}/image")
    async def get_image(entity_id: str, session: AsyncSession = Depends(get_session)):
        return await _get_image(kind, entity_id, session)

    @router.delete(f"/{kind}/{{entity_id}}/image", status_code=204)
    async def delete_image(entity_id: str, session: AsyncSession = Depends(get_session)):
        return await _delete_image(kind, entity_id, session)


for _kind in _ENTITY_MODELS:
    _register_image_routes(_kind)
