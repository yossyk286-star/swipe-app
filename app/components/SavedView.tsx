/* eslint-disable @next/next/no-img-element */

'use client';

// 「保存済み」タブ：Google マップの「保存済み」を参考にした画面
//   ① タグの一覧（あなたのタグ）  ② タグを開いた中身（お店の一覧）
// タグは Google マップの「リスト」に当たる。

import React, { useEffect, useMemo, useState } from 'react';
import {
  Favorite,
  LatLng,
  NAV_OFFSET,
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
  emoji,
  color,
  title,
  sub,
  onClick,
  tonal,
}: {
  icon: 'heart' | 'label' | 'plus';
  emoji?: string;
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
        gap: 14,
        width: '100%',
        padding: '12px 14px',
        marginBottom: 10,
        boxSizing: 'border-box',
        background: tonal ? 'transparent' : 'var(--card)',
        border: tonal ? '1.5px dashed var(--border)' : '1px solid var(--border)',
        borderRadius: 18,
        boxShadow: tonal ? 'none' : '0 2px 8px color-mix(in srgb, var(--elev) 50%, transparent)',
        textAlign: 'left',
        color: 'var(--text)',
      }}
    >
      <span
        style={{
          width: 46,
          height: 46,
          borderRadius: 15,
          background: tonal ? 'var(--accent-bg)' : `linear-gradient(135deg, color-mix(in srgb, ${color} 70%, #fff), ${color})`,
          color: tonal ? 'var(--accent)' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
        }}
      >
        {emoji ? <span style={{ fontSize: 20, lineHeight: 1 }}>{emoji}</span> : <Icon name={icon} size={20} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
  tagIcons,
}: {
  tagIcons: Record<string, string>;
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
    <div
      style={{
        padding: 14, marginBottom: 12, borderRadius: 20, background: 'var(--card)',
        border: '1px solid var(--border)', boxShadow: '0 2px 10px color-mix(in srgb, var(--elev) 50%, transparent)',
      }}
    >
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
            className="jp-text jp-title"
            style={{
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.35,
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
              className="jp-text"
              style={{
                fontSize: 13,
                lineHeight: 1.4,
                marginTop: 2,
                color: 'var(--text-muted)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
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
                  {tagIcons[t] ? `${tagIcons[t]} ` : ''}{t}
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
            style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 16, flex: '0 0 auto', background: 'var(--chip)' }}
          />
        ) : (
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 16,
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
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
          <button onClick={onDelete} style={{ ...pillBase, marginLeft: 'auto' }} aria-label={`${f.name} を削除`}>
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
  tagIcons?: Record<string, string>;
  tagCounts: Record<string, number>;
  userPos: LatLng | null;
  onRequestLocation?: (onDone: (ok: boolean) => void) => void;
  onOpenDetails: (id: string, name?: string) => void;
  onEditTags: (ids: string[]) => void;
  onDelete: (id: string) => void;
  onShare: (list: Favorite[]) => void;
  onShowOnMap: (tag: string | null) => void;
  onCreateTag: (name: string) => void;
  onManageTags: () => void;
  onGoSearch: () => void;
  /** 保存済みタブを表示中か（非表示のときは、スワイプで戻る処理を止める） */
  active?: boolean;
};

export default function SavedView(props: SavedViewProps) {
  const {
    favorites, allTags, tagIcons = {}, tagCounts, userPos, onRequestLocation,
    onOpenDetails, onEditTags, onDelete, onShare, onShowOnMap, onCreateTag, onManageTags,
    onGoSearch, active = true,
  } = props;

  const [openList, setOpenList] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('new');
  const [locState, setLocState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [minRating, setMinRating] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  // 右にスワイプで、ひとつ上の階層（タグの一覧）へ戻る
  // （画面の左端から始めたスワイプは、ブラウザ自身の「戻る」操作なので対象外）
  useEffect(() => {
    if (openList === null || !active) return;
    let st: { x: number; y: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const el = e.target as Element | null;
      const t = e.touches[0];
      if (!el || !t || !el.closest?.('#tab-scroller') || el.closest('.hscroll, input, textarea, select') || t.clientX < 24) {
        st = null;
        return;
      }
      st = { x: t.clientX, y: t.clientY };
    };
    const onEnd = (e: TouchEvent) => {
      const s0 = st;
      st = null;
      const t = e.changedTouches[0];
      if (!s0 || !t) return;
      const dx = t.clientX - s0.x;
      const dy = t.clientY - s0.y;
      if (dx > 70 && dx > Math.abs(dy) * 1.8) goList(null);
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openList, active]);

  // 開いているタグが削除・名前変更で無くなったら一覧に戻す
  const openTag = openList !== null && openList !== ALL_LIST && !allTags.includes(openList) ? null : openList;
  const isAllOpen = openTag === ALL_LIST;
  const searching = openTag === null && query.trim() !== '';

  function goList(id: string | null) {
    setOpenList(id);
    setQuery('');
    setMinRating(0);
    setFilterOpen(false);
    setTagFilter([]);
    setSelectMode(false);
    setSelected(new Set());
    setCreating(false);
    if (typeof document !== 'undefined') document.getElementById('tab-scroller')?.scrollTo({ top: 0 });
  }

  const rows = useMemo(() => {
    let arr: Favorite[] = [];
    if (openTag === null) {
      arr = searching ? favorites : [];
    } else if (openTag === ALL_LIST) {
      const act = tagFilter.filter((t) => allTags.includes(t));
      arr = act.length > 0 ? favorites.filter((f) => act.every((t) => f.tags?.includes(t))) : favorites;
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
    if (minRating > 0) arr = arr.filter((f) => (f.rating ?? 0) >= minRating);

    const out = [...arr];
    if (sort === 'new') return out.reverse(); // 配列は追加順なので逆順＝新しい順
    if (sort === 'rating') return out.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    return out.sort((a, b) => {
      const da = distanceTo(userPos, a.lat, a.lng);
      const db = distanceTo(userPos, b.lat, b.lng);
      return (da ?? Infinity) - (db ?? Infinity);
    });
  }, [favorites, openTag, searching, query, minRating, sort, userPos, tagFilter, allTags]);

  const filterActive = minRating > 0 || (isAllOpen && tagFilter.length > 0);
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
            tagIcons={tagIcons}
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
            {!isAll && tagIcons[openTag] ? <span style={{ fontSize: 17, lineHeight: 1 }}>{tagIcons[openTag]}</span> : <Icon name={isAll ? 'heart' : 'label'} size={18} />}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

        <div className="hscroll" style={{ display: 'flex', gap: 8, margin: '12px 0 16px', overflowX: 'auto' }}>
          {([['new', '新しい順'], ['rating', '評価順'], ['near', '近い順']] as [SortMode, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setSort(k);
                if (k === 'near' && onRequestLocation) {
                  setLocState('loading');
                  onRequestLocation((ok) => setLocState(ok ? 'idle' : 'failed'));
                }
              }}
              style={chip(sort === k)}
            >{label}</button>
          ))}
          <button
            onClick={() => setFilterOpen((o) => !o)}
            aria-expanded={filterOpen}
            style={chip(filterActive)}
          >
            絞り込み{filterActive ? '（ON）' : ''} {filterOpen ? '▲' : '▼'}
          </button>
        </div>

        {sort === 'near' && !userPos && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 2px 0' }}>
            {locState === 'failed'
              ? '現在地を取得できませんでした。位置情報の許可を確認してください（許可するまで並び替えできません）。'
              : '現在地を取得中…'}
          </div>
        )}

        {filterOpen && (
          <div
            style={{
              marginTop: 8, padding: 14, borderRadius: 14, background: 'var(--card)',
              boxShadow: '0 1px 4px var(--elev)', display: 'grid', gap: 14,
            }}
          >
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              評価
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                style={{ padding: '10px 12px', fontSize: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)' }}
              >
                <option value={0}>指定なし</option>
                <option value={3}>★3.0以上</option>
                <option value={3.5}>★3.5以上</option>
                <option value={4}>★4.0以上</option>
                <option value={4.5}>★4.5以上</option>
              </select>
            </label>

            {isAll && allTags.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  タグ（複数選ぶと、すべてのタグが付いたお店だけ）
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {allTags.map((t) => {
                    const on = tagFilter.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => setTagFilter((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
                        style={chip(on)}
                        aria-pressed={on}
                      >
                        {t}{tagCounts[t] ? ` ${tagCounts[t]}` : ''}{on ? ' ✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {filterActive && (
                <button onClick={() => { setMinRating(0); setTagFilter([]); }} style={pillBase}>条件を解除</button>
              )}
              <button onClick={() => setFilterOpen(false)} style={{ ...pillBase, marginLeft: 'auto' }}>閉じる</button>
            </div>
          </div>
        )}

        {renderRows(
          favorites.length === 0
            ? 'まだお気に入りがありません。'
            : (query.trim() || minRating > 0 || tagFilter.length > 0)
              ? '条件に合うお店がありません。'
              : 'このタグのお店はまだありません。お店の「タグ」ボタンから追加できます。'
        )}

        {/* まとめて操作バー */}
        {selectMode && (
          <div
            style={{
              position: 'fixed', left: 0, right: 0, bottom: NAV_OFFSET,
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
      <h1 style={{ margin: '4px 2px 14px', fontSize: 28, fontWeight: 800, letterSpacing: 0.5 }}>保存済み</h1>

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
          <div style={{ display: 'flex', alignItems: 'center', margin: '0 2px 12px' }}>
            <h2 style={{ flex: 1, margin: 0, fontSize: 18, fontWeight: 800 }}>あなたのタグ</h2>
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
              emoji={tagIcons[t]}
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
    </div>
  );
}
