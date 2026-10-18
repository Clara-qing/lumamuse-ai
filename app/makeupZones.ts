export type MakeupZoneId = "brows" | "eyes" | "nose" | "blush" | "contour" | "lips" | "highlight";

export type MakeupZoneDefinition = {
  id: MakeupZoneId;
  label: string;
  landmarkGroups: number[][];
};

// These are facial-geometry anchors, not detected makeup boundaries. They are
// used only to make a reference-image review and a teaching overlay legible.
export const makeupZones: MakeupZoneDefinition[] = [
  { id: "brows", label: "眉毛", landmarkGroups: [[46, 53, 52, 65, 55, 107, 66, 105, 63, 70], [276, 283, 282, 295, 285, 336, 296, 334, 293, 300]] },
  { id: "eyes", label: "眼妆", landmarkGroups: [[33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7], [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382]] },
  { id: "nose", label: "鼻影", landmarkGroups: [[168, 193, 122, 196, 3, 51, 45, 4, 5, 195, 197, 6], [168, 417, 351, 419, 248, 281, 275, 4, 5, 195, 197, 6]] },
  { id: "blush", label: "腮红", landmarkGroups: [[234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152], [454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152]] },
  { id: "contour", label: "面部修容", landmarkGroups: [[234, 127, 162, 21, 54, 103, 67, 109, 10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 2, 164, 0, 17, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93], [454, 356, 389, 251, 284, 332, 297, 338, 10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 2, 164, 0, 17, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323]] },
  { id: "lips", label: "唇妆", landmarkGroups: [[61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]] },
  { id: "highlight", label: "高光", landmarkGroups: [[168, 6, 197, 195, 5, 4, 1, 2], [50, 101, 205, 187, 123, 116], [280, 330, 425, 411, 352, 345]] },
];
