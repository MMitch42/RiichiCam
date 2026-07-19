Drop the exported model here as `tile-detector.onnx` (matches the default
model URL in `/debug/onnx` and `lib/detection/onnx-detector.ts`'s callers).

Export command (run wherever the trained weights live):

```
pip install ultralytics onnx onnxsim
yolo export model=best.pt format=onnx opset=12 imgsz=640 simplify=True
```

That produces `best.onnx` — rename/copy it to `tile-detector.onnx` in this
directory. Class order must match `lib/detection/tile-classes.ts`
(`CLASS_NAMES`, 37 entries); `decodeYoloOutput` throws immediately if the
model's channel count doesn't match, so a mismatch fails loud rather than
silently mislabeling tiles.
