import type { ImageWithUrl } from './useImages';

export interface TagGroup {
  tag: string;
  images: ImageWithUrl[];
}

export function groupByTag(images: ImageWithUrl[]): TagGroup[] {
  const tagMap = new Map<string, ImageWithUrl[]>();
  const untagged: ImageWithUrl[] = [];

  for (const img of images) {
    if (img.data.tags.length === 0) {
      untagged.push(img);
    } else {
      for (const tag of img.data.tags) {
        const group = tagMap.get(tag);
        if (group) {
          group.push(img);
        } else {
          tagMap.set(tag, [img]);
        }
      }
    }
  }

  const groups: TagGroup[] = [];
  const sortedTags = Array.from(tagMap.keys()).sort();
  for (const tag of sortedTags) {
    const imgs = tagMap.get(tag);
    if (imgs) {
      groups.push({ tag, images: imgs });
    }
  }

  if (untagged.length > 0) {
    groups.push({ tag: 'Untagged', images: untagged });
  }

  return groups;
}
