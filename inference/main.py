import mediapipe as mp
import cv2
import numpy as np
import json
from pathlib import Path
from datetime import datetime
import os
import boto3
from botocore.exceptions import BotoCoreError, ClientError

def upload_file_to_s3(local_path: str, bucket: str, s3_key: str, region: str | None = None):
    session = boto3.session.Session(region_name=region) if region else boto3.session.Session()
    s3 = session.client("s3")
    s3.upload_file(local_path, bucket, s3_key)

def sync_directory_to_s3(local_dir: str, bucket: str, s3_prefix: str = "", region: str | None = None):
    local_dir_path = Path(local_dir).resolve()
    session = boto3.session.Session(region_name=region) if region else boto3.session.Session()
    s3 = session.client("s3")

    for file_path in local_dir_path.rglob("*"):
        if file_path.is_file():
            relative = file_path.relative_to(local_dir_path).as_posix()
            key = f"{s3_prefix.rstrip('/')}/{relative}" if s3_prefix else relative
            s3.upload_file(str(file_path), bucket, key)

# -------------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------------

DISPLAY_WINDOW = False

OUTPUT_DIRECTORY = Path("../data/mediapipe")
OUTPUT_FILE = OUTPUT_DIRECTORY / "hand_rotation.json"

# Make sure the directory exists
OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)


# -------------------------------------------------------------------------
# Hand rotation
# -------------------------------------------------------------------------

def get_hand_rotation_vector(hand_landmarks, image_width, image_height):
    """
    Calculates the 3D rotation vector (rvec) of the hand using OpenCV solvePnP.
    """

    object_points = np.array([
        [0.0,  0.0, 0.0],   # 0: Wrist
        [-4.0, -5.0, 2.0],  # 5: Index MCP
        [0.0, -6.0, 2.0],   # 9: Middle MCP
        [4.0, -5.0, 2.0]    # 17: Pinky MCP
    ], dtype=np.float64)

    image_points = np.array([
        [
            hand_landmarks[0].x * image_width,
            hand_landmarks[0].y * image_height
        ],
        [
            hand_landmarks[5].x * image_width,
            hand_landmarks[5].y * image_height
        ],
        [
            hand_landmarks[9].x * image_width,
            hand_landmarks[9].y * image_height
        ],
        [
            hand_landmarks[17].x * image_width,
            hand_landmarks[17].y * image_height
        ]
    ], dtype=np.float64)

    focal_length = image_width
    center = (image_width / 2, image_height / 2)

    camera_matrix = np.array([
        [focal_length, 0, center[0]],
        [0, focal_length, center[1]],
        [0, 0, 1]
    ], dtype=np.float64)

    dist_coeffs = np.zeros((4, 1))

    success, rvec, tvec = cv2.solvePnP(
        object_points,
        image_points,
        camera_matrix,
        dist_coeffs,
        flags=cv2.SOLVEPNP_SQPNP
    )

    if success:
        return rvec, tvec

    return None, None


# -------------------------------------------------------------------------
# Save JSON
# -------------------------------------------------------------------------

def save_hand_data(hand_index, hand_landmarks, rvec, tvec):
    wrist = hand_landmarks[0]

    data = {
        "timestamp": datetime.now().isoformat(),
        "hand_index": hand_index,

        "wrist": {
            "x": float(wrist.x),
            "y": float(wrist.y),
            "z": float(wrist.z)
        },

        "rotation_vector": {
            "x": float(rvec[0][0]),
            "y": float(rvec[1][0]),
            "z": float(rvec[2][0])
        },

        "translation_vector": {
            "x": float(tvec[0][0]),
            "y": float(tvec[1][0]),
            "z": float(tvec[2][0])
        }
    }

    # Write atomically so another program won't read half-written JSON
    temporary_file = OUTPUT_FILE.with_suffix(".tmp")

    with temporary_file.open("w") as f:
        json.dump(data, f, indent=2)

    temporary_file.replace(OUTPUT_FILE)

    # output_file = "data/mediapipe/hand_rotation.json"
    # bucket_name = os.environ["S3_BUCKET"]  # set in environment
    # s3_key = "data/mediapipe/hand_rotation.json"
    print('trying to upload')
    # try:
    #     upload_file_to_s3(output_file, bucket_name, s3_key, region=os.getenv("AWS_REGION"))
    #     print(f"Uploaded {output_file} -> s3://{bucket_name}/{s3_key}")
    # except (BotoCoreError, ClientError) as e:
    #     print(f"S3 upload failed: {e}")



# -------------------------------------------------------------------------
# MediaPipe setup
# -------------------------------------------------------------------------

BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = HandLandmarkerOptions(
    base_options=BaseOptions(
        model_asset_path="./hand_landmarker.task",
        delegate=BaseOptions.Delegate.CPU
    ),
    running_mode=VisionRunningMode.IMAGE
)


# -------------------------------------------------------------------------
# Webcam
# -------------------------------------------------------------------------

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise RuntimeError("Could not open webcam.")

print("Starting hand tracking.")
print(f"Writing rotation data to: {OUTPUT_FILE.resolve()}")

if DISPLAY_WINDOW:
    print("Press 'q' to exit.")
else:
    print("Display disabled. Press Ctrl+C to exit.")


try:
    with HandLandmarker.create_from_options(options) as landmarker:

        while cap.isOpened():

            success, frame = cap.read()

            if not success:
                print("Ignoring empty camera frame.")
                continue

            height, width, _ = frame.shape

            # Convert OpenCV BGR -> RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            mp_image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=rgb_frame
            )

            # Detect hands
            results = landmarker.detect(mp_image)

            if results.hand_landmarks:

                for hand_index, hand_landmarks in enumerate(
                    results.hand_landmarks
                ):

                    wrist = hand_landmarks[0]

                    print(
                        f"Wrist XYZ -> "
                        f"x: {wrist.x:.3f}, "
                        f"y: {wrist.y:.3f}, "
                        f"z: {wrist.z:.3f}"
                    )

                    rvec, tvec = get_hand_rotation_vector(
                        hand_landmarks,
                        width,
                        height
                    )

                    if rvec is not None:

                        print(
                            "Rotation Vector:",
                            rvec.ravel()
                        )

                        save_hand_data(
                            hand_index,
                            hand_landmarks,
                            rvec,
                            tvec
                        )

            # -------------------------------------------------------------
            # Optional GUI
            # -------------------------------------------------------------

            if DISPLAY_WINDOW:
                cv2.imshow(
                    "Hand Tracking XYZ & Rotation",
                    frame
                )

                if cv2.waitKey(5) & 0xFF == ord("q"):
                    break


except KeyboardInterrupt:
    print("\nStopping hand tracking.")


finally:
    cap.release()

    if DISPLAY_WINDOW:
        cv2.destroyAllWindows()
