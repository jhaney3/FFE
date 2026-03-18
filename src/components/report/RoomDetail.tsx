interface RoomGroup {
  roomId: string;
  roomName: string;
  items: any[];
}

interface BuildingGroup {
  buildingName: string;
  levelName: string;
  rooms: RoomGroup[];
}

export default function RoomDetail({ items }: { items: any[] }) {
  // Group: (building + level) → room → items
  const buildingMap = new Map<string, BuildingGroup>();

  items.forEach(item => {
    const room = item.Rooms;
    const building = room?.building_name || 'Unknown Building';
    const level = room?.level_name || '';
    const bKey = `${level}||${building}`;

    if (!buildingMap.has(bKey)) {
      buildingMap.set(bKey, { buildingName: building, levelName: level, rooms: [] });
    }
    const bg = buildingMap.get(bKey)!;

    let rg = bg.rooms.find(r => r.roomId === room?.id);
    if (!rg) {
      rg = { roomId: room?.id || Math.random().toString(36).slice(2), roomName: room?.name || 'Unknown Room', items: [] };
      bg.rooms.push(rg);
    }
    rg.items.push(item);
  });

  const groups = Array.from(buildingMap.values()).sort((a, b) => {
    const lc = a.levelName.localeCompare(b.levelName);
    return lc !== 0 ? lc : a.buildingName.localeCompare(b.buildingName);
  });

  return (
    <section>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Inventory by Location</h2>
      {groups.map((bg, bi) => (
        <div key={bi} style={{ breakBefore: bi > 0 ? 'page' : 'auto' }} className="mb-8">
          {/* Building header */}
          <div className="bg-gray-800 text-white px-4 py-2 rounded-t font-bold text-base flex items-center gap-2 mb-0">
            {bg.levelName && (
              <>
                <span className="text-gray-400 text-sm font-normal">{bg.levelName}</span>
                <span className="text-gray-500">›</span>
              </>
            )}
            <span>{bg.buildingName}</span>
          </div>

          {bg.rooms.map((rg, ri) => (
            <div key={ri} className="border border-gray-200 border-t-0 last:rounded-b">
              {/* Room header */}
              <div className="bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 border-b border-gray-200">
                {rg.roomName}
              </div>

              {rg.items.map((item, ii) => {
                const total = (item.qty_excellent || 0) + (item.qty_good || 0) + (item.qty_fair || 0) + (item.qty_poor || 0);
                return (
                  <div
                    key={ii}
                    className="flex items-start gap-4 px-4 py-3 border-b last:border-b-0 border-gray-100"
                    style={{ breakInside: 'avoid' }}
                  >
                    {/* Photo */}
                    <div className="w-16 h-16 shrink-0 rounded border border-gray-200 overflow-hidden bg-gray-50">
                      {item.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photo_url}
                          alt={item.ItemTypes?.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">No photo</div>
                      )}
                    </div>

                    {/* Type & attributes & notes */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm">{item.ItemTypes?.name || 'Unknown'}</div>
                      {(item.attributes?.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.attributes.map((attr: string, ai: number) => (
                            <span key={ai} className="text-[10px] uppercase font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-sm">
                              {attr}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.notes && (
                        <p className="text-xs text-gray-500 mt-1 italic">{item.notes}</p>
                      )}
                    </div>

                    {/* Condition summary */}
                    <div className="shrink-0 text-right min-w-[90px]">
                      <div className="text-sm font-bold text-gray-800 mb-1">Total: {total}</div>
                      <div className="space-y-0.5">
                        {(item.qty_excellent > 0) && (
                          <div className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">{item.qty_excellent} Excellent</div>
                        )}
                        {(item.qty_good > 0) && (
                          <div className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{item.qty_good} Good</div>
                        )}
                        {(item.qty_fair > 0) && (
                          <div className="text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded">{item.qty_fair} Fair</div>
                        )}
                        {(item.qty_poor > 0) && (
                          <div className="text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded">{item.qty_poor} Poor</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
