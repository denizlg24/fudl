import cv2
import os

video_folder = "raw/videos"
images_folder = "raw/images"


os.makedirs(images_folder, exist_ok=True)

#gets all videos in video folder into videos
videos = [os.path.join(video_folder, f) for f in os.listdir(video_folder) if f.endswith(".mp4")]

for vid_index, video_path in enumerate(videos): #gets index and path for each video
    cap = cv2.VideoCapture(video_path) #captures video frames
    fps
    while True: 
        ret, frame = cap.read() #reads each frame

        if not ret:
            break
    
        


