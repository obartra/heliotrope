export interface VariantSpec {
  key: string;
  width: number;
  height: number;
  format: 'jpeg' | 'png';
  quality?: number;
  extension: string;
  contentType: string;
}

export const VARIANT_SPECS: readonly VariantSpec[] = [
  {
    key: 'slack',
    width: 512,
    height: 512,
    format: 'jpeg',
    quality: 85,
    extension: 'jpg',
    contentType: 'image/jpeg',
  },
];
