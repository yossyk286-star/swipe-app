/* eslint-disable @next/next/no-img-element */

'use client';

// 「保存済み」タブ：Google マップの「保存済み」を参考にした画面
//   ① タグの一覧（あなたのタグ）  ② タグを開いた中身（お店の一覧）
// タグは Google マップの「リスト」に当たる。

import React, { useMemo, useRef, useState } from 'react';
import {
  Favorite,
  LatLng,
  NAV_HEIGHT,
  distanceTo,
  formatCount,
  formatDistance,
  mapsDirectionsUrl,
  mapsPlaceUrl,
  priceLabel,
  shortAddress,
  typeLabel,
} from '../lib/swipick';
import { Icon } from './Icons';

export const ALL_LIST = '__all__';

type SortMode = 'new' | 'rating' | 'near';

const LIST_COLORS = ['#ea4335', '#4285f4', '#34a853', '#f29900', '#a142f4', '#e8710a', '#12b5cb', '#d93025'];
function tagColor(tag: string) {
  let h = 0;
  for (const ch of tag) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return LIST_COLORS[h % LIST_COLORS.length];
}

function stars(r: number) {
  const n = Math.max(0, Math.min(5, Math.round(r)));
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
}

/** ------------ 共通スタイル ------------ */
const pillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 14px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontSize: 13,
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  flex: '0 0 auto',
};

const pillPrimary: React.CSSProperties = {
  ...pillBase,
  border: '1px solid transparent',
  background: 'var(--accent-bg)',
  color: 'var(--accent)',
  fontWeight: 600,
};

const chip = (active: boolean): React.CSSProperties => ({
  ...pillBase,
  padding: '6px 12px',
  border: active ? '1px solid transparent' : '1px solid var(--border)',
  background: active ? 'var(--accent-bg)' : 'var(--card)',
  color: active ? 'var(--accent)' : 'var(--text)',
  fontWeight: active ? 700 : 500,
});

const roundBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: '50%',
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
};

/** ------------ 部品 ------------ */
function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        height: 44,
        borderRadius: 999,
        background: 'var(--card)',
        boxShadow: '0 1px 4px var(--elev)',
        color: 'var(--text-muted)',
      }}
    >
      <Icon name="search" size={22} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 16,
          color: 'var(--text)',
        }}
      />
    </div>
  );
}

function ListRow({
  icon,
  color,
  title,
  sub,
  onClick,
  tonal,
}: {
  icon: 'heart' | 'label' | 'plus';
  color: string;
  title: string;
  sub?: string;
  onClick: () => void;
  tonal?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        padding: '10px 2px',
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        color: 'var(--text)',
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: tonal ? 'var(--accent-bg)' : color,
          color: tonal ? 'var(--accent)' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
        }}
      >
        <Icon name={icon} size={20} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        {sub && <span style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</span>}
      </span>
      {!tonal && <Icon name="chevronRight" color="var(--text-muted)" />}
    </button>
  );
}

function PlaceRow({
  f,
  pos,
  selectMode,
  selected,
  onToggleSelect,
  onOpen,
  onEditTags,
  onDelete,
}: {
  f: Favorite;
  pos: LatLng | null;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onEditTags: () => void;
  onDelete: () => void;
}) {
  const cat = typeLabel(f.types);
  const price = priceLabel(f.priceLevel);
  const dist = formatDistance(distanceTo(pos, f.lat, f.lng));
  const addr = shortAddress(f.address);
  const line1 = [cat, price].filter(Boolean).join(' · ');
  const line2 = [dist, addr].filter(Boolean).join(' · ');
  const tags = f.tags || [];

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div
        onClick={selectMode ? onToggleSelect : onOpen}
        style={{ display: 'flex', gap: 12, cursor: 'pointer' }}
      >
        {selectMode && (
          <div style={{ paddingTop: 2 }}>
            <Icon
              name={selected ? 'checkCircle' : 'circleOutline'}
              color={selected ? 'var(--accent)' : 'var(--text-muted)'}
            />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {f.name}
          </div>

          {f.rating != null ? (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, fontSize: 13, marginTop: 4 }}>
              <span>{f.rating.toFixed(1)}</span>
              <span style={{ color: '#f9ab00', letterSpacing: 1 }}>{stars(f.rating)}</span>
              <span style={{ color: 'var(--text-muted)' }}>({formatCount(f.userRatingsTotal)})</span>
              {line1 && <span style={{ color: 'var(--text-muted)' }}>· {line1}</span>}
            </div>
          ) : (
            line1 && <div style={{ fontSize: 13, marginTop: 4, color: 'var(--text-muted)' }}>{line1}</div>
          )}

          {line2 && (
            <div
              style={{
                fontSize: 13,
                marginTop: 2,
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {line2}
            </div>
          )}

          {tags.length > 0 && (
            <div className="hscroll" style={{ display: 'flex', gap: 6, marginTop: 6, overflowX: 'auto' }}>
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    flex: '0 0 auto',
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'var(--chip)',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {f.image ? (
          <img
            src={f.image}
            alt={f.name}
            loading="lazy"
            style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 12, flex: '0 0 auto', background: 'var(--chip)' }}
          />
        ) : (
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 12,
              flex: '0 0 auto',
              background: 'var(--chip)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            🍽
          </div>
        )}
      </div>

      {!selectMode && (
        <div className="hscroll" style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto' }}>
          <a href={mapsDirectionsUrl(f.name, f.id)} target="_blank" rel="noreferrer" style={pillPrimary}>
            <Icon name="directions" size={18} />
            経路
          </a>
          <a href={mapsPlaceUrl(f.name, f.id)} target="_blank" rel="noreferrer" style={pillBase}>
            <Icon name="pin" size={18} />
            地図
          </a>
          <button onClick={onEditTags} style={pillBase}>
            <Icon name="label" size={18} />
            タグ
          </button>
          <button onClick={onDelete} style={pillBase} aria-label={`${f.name} を削除`}>
            <Icon name="delete" size={18} />
            削除
          </button>
        </div>
      )}
    </div>
  );
}

/** ------------ 画面本体 ------------ */
export type SavedViewProps = {
  favorites: Favorite[];
  allTags: string[];
  tagCounts: Record<string, number>;
  userPos: LatLng | null;
  seenCount: number;
  onOpenDetails: (id: string, name?: string) => void;
  onEditTags: (ids: string[]) => void;
  onDelete: (id: string) => void;
  onShare: (list: Favorite[]) => void;
  onShowOnMap: (tag: string | null) => void;
  onCreateTag: (name: string) => void;
  onManageTags: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onResetSeen: () => void;
  onGoSearch: () => void;
};

export default function SavedView(props: SavedViewProps) {
  const {
    favorites, allTags, tagCounts, userPos, seenCount,
    onOpenDetails, onEditTags, onDelete, onShare, onShowOnMap, onCreateTag, onManageTags,
    onExport, onImport, onResetSeen, onGoSearch,
  } = props;

  const [openList, setOpenList] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('new');
  const [rating4, setRating4] = useState(false);
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [tagMode, setTagMode] = useState<'any' | 'all'>('any');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);

  // 開いているタグが削除・名前変更で無くなったら一覧に戻す
  const openTag = openList !== null && openList !== ALL_LIST && !allTags.includes(openList) ? null : openList;
  const searching = openTag === null && query.trim() !== '';
  const effTagFilter = useMemo(() => [...tagFilter].filter((t) => allTags.includes(t)), [tagFilter, allTags]);

  function goList(id: string | null) {
    setOpenList(id);
    setQuery('');
    setRating4(false);
    setTagFilter(new Set());
    setSelectMode(false);
    setSelected(new Set());
    setCreating(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }

  const rows = useMemo(() => {
    let arr: Favorite[] = [];
    if (openTag === null) {
      arr = searching ? favorites : [];
    } else if (openTag === ALL_LIST) {
      arr = favorites;
    } else {
      const tag = openTag;
      arr = favorites.filter((f) => f.tags?.includes(tag));
    }
    const text = query.trim().toLowerCase();
    if (text) {
      arr = arr.filter((f) =>
        f.name.toLowerCase().includes(text) ||
        (f.address || '').toLowerCase().includes(text) ||
        (f.tags || []).some((t) => t.toLowerCase().includes(text))
      );
    }
    if (openTag === ALL_LIST && effTagFilter.length > 0) {
      arr = arr.filter((f) => (tagMode === 'all'
        ? effTagFilter.every((t) => f.tags?.includes(t))
        : effTagFilter.some((t) => f.tags?.includes(t))));
    }
    if (rating4) arr = arr.filter((f) => (f.rating ?? 0) >= 4);

    const out = [...arr];
    if (sort === 'new') return out.reverse(); // 配列は追加順なので逆順＝新しい順
    if (sort === 'rating') return out.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    return out.sort((a, b) => {
      const da = distanceTo(userPos, a.lat, a.lng);
      const db = distanceTo(userPos, b.lat, b.lng);
      return (da ?? Infinity) - (db ?? Infinity);
    });
  }, [favorites, openTag, searching, query, effTagFilter, tagMode, rating4, sort, userPos]);

  const selectedVisible = rows.filter((f) => selected.has(f.id)).map((f) => f.id);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function submitNewTag(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onCreateTag(name);
    setNewName('');
    setCreating(false);
  }

  const renderRows = (emptyText: string) => (
    <div>
      {rows.length === 0 ? (
        <div style={{ padding: '32px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7 }}>
          {emptyText}
        </div>
      ) : (
        rows.map((f) => (
          <PlaceRow
            key={f.id}
            f={f}
            pos={userPos}
            selectMode={selectMode}
            selected={selected.has(f.id)}
            onToggleSelect={() => toggleSelect(f.id)}
            onOpen={() => onOpenDetails(f.id, f.name)}
            onEditTags={() => onEditTags([f.id])}
            onDelete={() => onDelete(f.id)}
          />
        ))
      )}
    </div>
  );

  /** ---------- ② タグを開いた画面 ---------- */
  if (openTag !== null) {
    const isAll = openTag === ALL_LIST;
    const title = isAll ? 'すべてのお気に入り' : openTag;
    const total = isAll ? favorites.length : (tagCounts[openTag] ?? 0);
    const color = isAll ? '#ea4335' : tagColor(openTag);

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => goList(null)} aria-label="戻る" style={roundBtn}>
            <Icon name="back" />
          </button>
          <span
            style={{
              width: 32, height: 32, borderRadius: '50%', background: color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
            }}
          >
            <Icon name={isAll ? 'heart' : 'label'} size={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{total}件の場所</div>
          </div>
        </div>

        <div className="hscroll" style={{ display: 'flex', gap: 8, margin: '14px 0', overflowX: 'auto' }}>
          {selectMode ? (
            <>
              <button
                onClick={() => setSelected(selectedVisible.length === rows.length ? new Set() : new Set(rows.map((f) => f.id)))}
                style={pillBase}
              >
                <Icon name="check" size={18} />
                {selectedVisible.length === rows.length && rows.length > 0 ? '全解除' : '全選択'}
              </button>
              <button onClick={() => { setSelectMode(false); setSelected(new Set()); }} style={pillBase}>
                完了
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onShare(rows)} style={pillPrimary} disabled={rows.length === 0}>
                <Icon name="share" size={18} />
                共有
              </button>
              <button onClick={() => onShowOnMap(isAll ? null : openTag)} style={pillBase}>
                <Icon name="map" size={18} />
                地図で見る
              </button>
              <button onClick={() => setSelectMode(true)} style={pillBase} disabled={rows.length === 0}>
                <Icon name="checkCircle" size={18} />
                選択
              </button>
            </>
          )}
        </div>

        <SearchBox value={query} onChange={setQuery} placeholder={`${title}の中を検索`} />

        <div className="hscroll" style={{ display: 'flex', gap: 8, margin: '12px 0 2px', overflowX: 'auto' }}>
          {([['new', '新しい順'], ['rating', '評価順'], ['near', '近い順']] as [SortMode, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setSort(k)} style={chip(sort === k)}>{label}</button>
          ))}
          <button onClick={() => setRating4((v) => !v)} style={chip(rating4)}>★4.0以上</button>
          {isAll && allTags.map((t) => {
            const active = tagFilter.has(t);
            return (
              <button
                key={t}
                onClick={() => setTagFilter((prev) => {
                  const n = new Set(prev);
                  if (n.has(t)) n.delete(t); else n.add(t);
                  return n;
                })}
                style={chip(active)}
              >
                {t}
              </button>
            );
          })}
        </div>

        {isAll && effTagFilter.length >= 2 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            タグの条件：
            <button onClick={() => setTagMode('any')} style={chip(tagMode === 'any')}>いずれか</button>
            <button onClick={() => setTagMode('all')} style={chip(tagMode === 'all')}>すべて含む</button>
          </div>
        )}

        {renderRows(
          favorites.length === 0
            ? 'まだお気に入りがありません。'
            : (query.trim() || rating4 || effTagFilter.length > 0)
              ? '条件に合うお店がありません。'
              : 'このタグのお店はまだありません。お店の「タグ」ボタンから追加できます。'
        )}

        {/* まとめて操作バー */}
        {selectMode && (
          <div
            style={{
              position: 'fixed', left: 0, right: 0, bottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
              zIndex: 2900, background: 'var(--card)', borderTop: '1px solid var(--border)',
              boxShadow: '0 -4px 14px var(--elev)',
            }}
          >
            <div style={{ maxWidth: 560, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, fontSize: 14 }}>{selectedVisible.length}件を選択中</div>
              <button
                onClick={() => onEditTags(selectedVisible)}
                disabled={selectedVisible.length === 0}
                style={{ ...pillPrimary, padding: '9px 16px', opacity: selectedVisible.length === 0 ? 0.5 : 1 }}
              >
                <Icon name="label" size={18} />
                タグを付ける・外す
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /** ---------- ① タグの一覧（保存済みのトップ） ---------- */
  return (
    <div>
      <h1 style={{ margin: '4px 2px 14px', fontSize: 24, fontWeight: 600 }}>保存済み</h1>

      <SearchBox value={query} onChange={setQuery} placeholder="保存した場所を検索" />

      {searching ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 2px' }}>検索結果 {rows.length}件</div>
          {renderRows('見つかりませんでした。店名・住所・タグで検索できます。')}
        </div>
      ) : favorites.length === 0 ? (
        <div style={{ padding: '56px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div
            style={{
              width: 72, height: 72, borderRadius: '50%', background: 'var(--accent-bg)', color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}
          >
            <Icon name="bookmark" size={36} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>保存した場所はまだありません</div>
          <div style={{ fontSize: 14, lineHeight: 1.7, marginTop: 6 }}>
            「探す」で気になるお店を右にスワイプ（♥）すると、ここに保存されます。
          </div>
          <button onClick={onGoSearch} style={{ ...pillPrimary, marginTop: 18, padding: '10px 22px', fontSize: 15 }}>
            お店を探す
          </button>
        </div>
      ) : (
        <section style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', margin: '0 2px 4px' }}>
            <h2 style={{ flex: 1, margin: 0, fontSize: 18, fontWeight: 600 }}>あなたのタグ</h2>
            <button onClick={onManageTags} style={pillBase} aria-label="タグの管理">
              <Icon name="tune" size={18} />
              管理
            </button>
          </div>

          <ListRow
            icon="heart"
            color="#ea4335"
            title="すべてのお気に入り"
            sub={`${favorites.length}件の場所`}
            onClick={() => goList(ALL_LIST)}
          />
          {allTags.map((t) => (
            <ListRow
              key={t}
              icon="label"
              color={tagColor(t)}
              title={t}
              sub={`${tagCounts[t] ?? 0}件の場所`}
              onClick={() => goList(t)}
            />
          ))}

          {creating ? (
            <form onSubmit={submitNewTag} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px' }}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="新しいタグの名前"
                aria-label="新しいタグの名前"
                style={{
                  flex: 1, minWidth: 0, padding: '10px 12px', fontSize: 16, borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card)',
                }}
              />
              <button type="submit" disabled={newName.trim() === ''} style={{ ...pillPrimary, opacity: newName.trim() === '' ? 0.5 : 1 }}>
                作成
              </button>
              <button type="button" onClick={() => { setCreating(false); setNewName(''); }} style={pillBase}>
                やめる
              </button>
            </form>
          ) : (
            <ListRow icon="plus" color="" tonal title="新しいタグを作成" onClick={() => setCreating(true)} />
          )}
        </section>
      )}

      {/* バックアップ */}
      {!searching && (
        <section
          style={{
            marginTop: 28, padding: 14, borderRadius: 14, boxSizing: 'border-box',
            background: 'var(--card)', boxShadow: '0 1px 4px var(--elev)', fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>データのバックアップ</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
            お気に入りとタグは、この端末のブラウザ内だけに保存されています。機種変更やブラウザのデータ削除の前に書き出しておくと、別の端末で読み込めます。
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={onExport} disabled={favorites.length === 0} style={{ ...pillBase, opacity: favorites.length === 0 ? 0.5 : 1 }}>
              ⬇️ 書き出す
            </button>
            <button onClick={() => importRef.current?.click()} style={pillBase}>
              ⬆️ 読み込む
            </button>
            {seenCount > 0 && (
              <button onClick={onResetSeen} style={pillBase}>
                見送り履歴（{seenCount}件）をリセット
              </button>
            )}
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImport(file);
                e.target.value = '';
              }}
            />
          </div>
        </section>
      )}
    </div>
  );
}
