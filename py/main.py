import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# Create a hand landmarker instance forcing CPU execution
options = HandLandmarkerOptions(
    base_options=BaseOptions(
        model_asset_path='./hand_landmarker.task',
        delegate=BaseOptions.Delegate.CPU  # <-- This bypasses the Metal GPU crash
    ),
    running_mode=VisionRunningMode.IMAGE
)

with HandLandmarker.create_from_options(options) as landmarker:
    print('123')
