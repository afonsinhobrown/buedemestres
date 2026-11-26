export type CategoryRow = {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
  parent_id: number | null;
  provider_count: number;
};

export type CategoryNode = CategoryRow & {
  children: CategoryNode[];
  totalProviders: number;
};

export type DiscoveryProvider = {
  profileId: string;
  slug: string;
  businessName: string;
  headline: string | null;
  ratingAvg: number;
  ratingCount: number;
  verified: boolean;
  available: boolean;
  featured: boolean;
  lat: number | null;
  lng: number | null;
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  districtName: string | null;
  provinceName: string | null;
  jobsCompleted: number;
};

export type DiscoveryDistrict = {
  id: number;
  name: string;
  province: string;
};

export function buildCategoryTree(rows: CategoryRow[]): CategoryNode[] {
  const byParent = new Map<number | null, CategoryNode[]>();

  for (const row of rows) {
    const node: CategoryNode = {
      ...row,
      children: [],
      totalProviders: row.provider_count,
    };
    const siblings = byParent.get(row.parent_id) ?? [];
    siblings.push(node);
    byParent.set(row.parent_id, siblings);
  }

  const attach = (parentId: number | null): CategoryNode[] => {
    const nodes = byParent.get(parentId) ?? [];
    return nodes.map((node) => {
      const children = attach(node.id);
      return {
        ...node,
        children,
        totalProviders:
          node.provider_count + children.reduce((sum, child) => sum + child.totalProviders, 0),
      };
    });
  };

  return attach(null);
}

export function findCategoryBySlug(
  tree: CategoryNode[],
  slug: string | number | null | undefined
): { category: CategoryNode; parent: CategoryNode | null } | null {
  if (slug === null || slug === undefined || slug === '') return null;
  const wanted = String(slug).toLowerCase();

  for (const parent of tree) {
    if (parent.slug.toLowerCase() === wanted || String(parent.id) === wanted) {
      return { category: parent, parent: null };
    }
    for (const child of parent.children) {
      if (child.slug.toLowerCase() === wanted || String(child.id) === wanted) {
        return { category: child, parent };
      }
    }
  }

  return null;
}

export function ratingLabel(ratingAvg: number, ratingCount: number): {
  label: string;
  isNew: boolean;
} {
  if (!ratingCount || ratingAvg <= 0) return { label: 'Novo', isNew: true };
  return {
    label: ratingAvg.toFixed(1).replace('.', ','),
    isNew: false,
  };
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const earthRadiusKm = 6371;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}
