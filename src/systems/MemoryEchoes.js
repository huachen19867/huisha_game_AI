import { Maps } from '../data/Maps.js';

// Derive a room variant from discoveries. Never edit the shared map definition:
// restarting or loading an earlier checkpoint must restore the earlier room.
export function getRoomObjects(mapId, state) {
    const base = Maps[mapId].objects;
    if (mapId !== 'room_corridor') return base;
    const memories = state.storyFlags?.memories || {};
    return {
        ...base,
        photos: base.photos.map(photo => memories.school && photo.id === 3 ? {
            ...photo,
            texture: 'photo_uncovered',
            tint: 0xe7c994,
            title: '重新显影的旧照',
            text: '照片剪掉的半边重新显出一个轮廓：父亲把奖状卷成细筒，另一只手正拉着我的胳膊。\n相纸边缘有当年留下的一行小字：“老师说第二名也很好。爸爸说，回家再算账。”\n我把卷起的相纸压平，没有再遮住那半边。'
        } : { ...photo }),
        interactables: [
            ...(base.interactables || []),
            ...(memories.hospital ? [{
                id: 'hospital_echo', x: 48, y: 540,
                texture: 'prescription_envelope',
                interactLabel: '门缝里的处方封套',
                documentTitle: '没有寄出的复诊提醒',
                documentText: '一只蓝边封套从药柜小间的门缝里露出来，收件人是王秀兰。\n“请于一周后复诊。若家属不能陪同，可联系院方协助。”\n封口没有拆过，背面被写上“退回”。我把它翻回写着母亲名字的那一面。'
            }] : [])
        ]
    };
}
