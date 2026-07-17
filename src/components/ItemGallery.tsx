import { Gallery, type GalleryItem, type GalleryProps } from "@/components/chrome/gallery";

// Re-export the item shape so existing importers (e.g. lib/items.ts) keep working
// now that the card grid is backed by the chrome Gallery component.
export type { GalleryItem };

export function ItemGallery(props: GalleryProps) {
	return <Gallery {...props} />;
}
