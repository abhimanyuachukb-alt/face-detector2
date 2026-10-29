export interface RectBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface FaceResult {
  boxes: RectBox[];
  width: number;
  height: number;
  mirrored: boolean;
}
