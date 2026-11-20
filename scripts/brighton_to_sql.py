"""Generate an idempotent SQL import of Brighton listings for Supabase.

Usage:
  python scripts/brighton_to_sql.py --email you@example.com \
      --active data/listing.json --expired data/listing_kadaluarsa.json \
      [--active-limit N] [--expired-limit N] -o supabase/imports/brighton_import.sql

Active listings -> status 'published', expired listings -> status 'archived'.
Re-running the generated SQL updates existing rows (matched on source='brighton', source_id).
"""
import argparse
import json
import re

TYPE_MAP = {
    "rumah": "house", "rumah kos": "house", "kost": "house",
    "tanah": "land", "apartment": "apartment", "apartemen": "apartment",
    "ruko": "shop", "toko": "shop", "gudang": "warehouse", "villa": "villa",
}
TZ = "+07"  # Brighton timestamps are WIB


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def num(v, positive=True):
    if v in (None, ""):
        return None
    try:
        f = float(str(v).replace(",", "."))
    except ValueError:
        return None
    if positive and f <= 0:
        return None
    return int(f) if f.is_integer() else f


def count(v):
    """'3' -> 3, '7+1' -> 8, None/'' -> 0."""
    if not v:
        return 0
    return sum(int(p) for p in re.findall(r"\d+", str(v)))


def ts(v):
    return f"{v}{TZ}" if v else None


def clean_text(s):
    """Brighton text sometimes holds literal escapes like '\\ud83c\\udfe1' or '\\"'; turn them into real characters."""
    if not s:
        return s

    def dec(m):
        units = [int(h, 16) for h in re.findall(r"[0-9a-fA-F]{4}", m.group(0))]
        raw = b"".join(u.to_bytes(2, "little") for u in units)
        return raw.decode("utf-16-le", errors="replace")

    s = re.sub(r"(?:\\u[0-9a-fA-F]{4})+", dec, s)
    return re.sub(r'\\+(["\'])', r"\1", s)


def rupiah(v):
    return f"Rp{int(v):,}".replace(",", ".")


def convert(x, status):
    trans = x["Transaction"]
    description = clean_text((x.get("Other") or "").strip())
    if trans == "JualSewa":
        tx = "sale"
        if x.get("Price2"):
            description += f"\n\nJuga tersedia untuk disewa: {rupiah(x['Price2'])}."
    elif trans == "Sewa":
        tx = "rent"
    else:
        tx = "sale"
    loc = x.get("Location") or {}
    province = (x.get("Province") or {}).get("Title") or (loc.get("Province") or {}).get("Title") or loc.get("Rumah123Province") or ""
    photos = x.get("Photos") or []
    created = ts(x.get("Created"))
    return {
        "row": {
            "source_id": str(x["ID"]),
            "title": clean_text((x.get("Title") or "").strip())[:180],
            "slug": x["URLSegment"][:220],
            "description": description or None,
            "transaction_type": tx,
            "property_type": TYPE_MAP.get((x.get("Type") or "").strip().lower(), "other"),
            "price": x["Price"],
            "land_area": num(x.get("LT")),
            "building_area": num(x.get("LB")),
            "bedrooms": count(x.get("KT")),
            "bathrooms": count(x.get("KM")),
            "floors": count(x.get("Tingkat")) or 1,
            "electricity": num(x.get("Listrik")),
            "certificate": x.get("Certificate") or None,
            "province_name": province,
            "city_name": loc.get("Title") or "",
            "district_name": (x.get("Area") or {}).get("Title"),
            "address": (x.get("Address") or "").strip() or None,
            "latitude": num(x.get("Latitude"), positive=False),
            "longitude": num(x.get("Longitude"), positive=False),
            "cover_image_url": photos[0].get("Original") if photos else None,
            "status": status,
            "published_at": (ts(x.get("PropertyDate")) or created) if status == "published" else created,
            "created_at": created,
        },
        "images": [(str(x["ID"]), p.get("Original"), p.get("Title"), i) for i, p in enumerate(photos) if p.get("Original")],
    }


COLS = ["source_id", "title", "slug", "description", "transaction_type", "property_type", "price",
        "land_area", "building_area", "bedrooms", "bathrooms", "floors", "electricity", "certificate",
        "province_name", "city_name", "district_name", "address", "latitude", "longitude",
        "cover_image_url", "status", "published_at", "created_at"]
CASTS = {"transaction_type": "::ezy.transaction_type", "property_type": "::ezy.property_type",
         "status": "::ezy.property_status", "price": "::numeric", "land_area": "::numeric",
         "building_area": "::numeric", "bedrooms": "::int", "bathrooms": "::int", "floors": "::int",
         "electricity": "::int", "latitude": "::numeric", "longitude": "::numeric",
         "published_at": "::timestamptz", "created_at": "::timestamptz"}


def build(email, items):
    rows = [it["row"] for it in items]
    images = [img for it in items for img in it["images"]]
    ids = ", ".join(q(r["source_id"]) for r in rows)
    values = ",\n  ".join("(" + ", ".join(q(r[c]) for c in COLS) + ")" for r in rows)
    select_cols = ", ".join(f"v.{c}{CASTS.get(c, '')}" for c in COLS)
    update_cols = ", ".join(f"{c} = excluded.{c}" for c in COLS if c not in ("source_id", "created_at"))
    img_values = ",\n  ".join("(" + ", ".join(q(v) for v in img) + ")" for img in images)
    status_counts = {}
    for r in rows:
        status_counts[r["status"]] = status_counts.get(r["status"], 0) + 1

    return f"""-- Brighton -> Supabase import ({len(rows)} listings: {status_counts}, {len(images)} photos)
-- Generated by scripts/brighton_to_sql.py. Safe to run more than once.
-- Run in Supabase Dashboard > SQL Editor, after supabase/migrations/0001_init.sql.
-- Writes only to schema "ezy".
-- Every statement is self-contained (no temp tables): the SQL Editor may run
-- statements on different connections.

begin;

-- 1) Make sure the owning account has an EzyProperty agent profile
do $$
begin
  if not exists (select 1 from auth.users where lower(email) = lower({q(email)})) then
    raise exception 'User with email % not found. Register at /register in the EzyProperty app first, or change the email in this file.', {q(email)};
  end if;
end $$;

insert into ezy.profiles (id, full_name, email)
select id, coalesce(raw_user_meta_data ->> 'full_name', ''), email
from auth.users where lower(email) = lower({q(email)})
on conflict (id) do nothing;

-- 2) Upsert listings (agent = the profile of that account)
insert into ezy.properties (agent_id, source, {", ".join(COLS)})
select a.id, 'brighton', {select_cols}
from (values
  {values}
) as v({", ".join(COLS)})
join ezy.profiles a on lower(a.email) = lower({q(email)})
on conflict (source, source_id) do update set {update_cols};

-- 3) Replace photos of the imported listings
delete from ezy.property_images
where property_id in (select id from ezy.properties where source = 'brighton' and source_id in ({ids}));

insert into ezy.property_images (property_id, image_url, alt_text, sort_order)
select p.id, v.image_url, v.alt_text, v.sort_order::int
from (values
  {img_values}
) as v(source_id, image_url, alt_text, sort_order)
join ezy.properties p on p.source = 'brighton' and p.source_id = v.source_id;

commit;

-- 4) Check
select status, count(*) as listings,
       (select count(*) from ezy.property_images i join ezy.properties p2 on p2.id = i.property_id
         where p2.source = 'brighton' and p2.status = p.status) as photos
from ezy.properties p where source = 'brighton' group by status;
"""


def load(path, limit):
    data = json.load(open(path, encoding="utf-8"))["Data"]
    return data[:limit] if limit else data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True, help="email of the owning profile in Supabase")
    ap.add_argument("--active", default="data/listing.json")
    ap.add_argument("--expired", default="data/listing_kadaluarsa.json")
    ap.add_argument("--active-limit", type=int, default=0, help="0 = all")
    ap.add_argument("--expired-limit", type=int, default=0, help="0 = all")
    ap.add_argument("-o", "--output", default="supabase/imports/brighton_import.sql")
    a = ap.parse_args()

    items = [convert(x, "published") for x in load(a.active, a.active_limit)]
    items += [convert(x, "archived") for x in load(a.expired, a.expired_limit)]

    slugs = [it["row"]["slug"] for it in items]
    dup = {s for s in slugs if slugs.count(s) > 1}
    if dup:
        raise SystemExit(f"Duplicate slugs: {dup}")
    bad = [it["row"]["source_id"] for it in items if not it["row"]["price"] or it["row"]["price"] <= 0]
    if bad:
        raise SystemExit(f"Listings with price <= 0: {bad}")

    import os
    os.makedirs(os.path.dirname(a.output), exist_ok=True)
    with open(a.output, "w", encoding="utf-8", newline="\n") as f:
        f.write(build(a.email, items))
    print(f"Wrote {a.output}: {len(items)} listings")


if __name__ == "__main__":
    main()
