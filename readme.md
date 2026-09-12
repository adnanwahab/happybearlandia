
# HappyBearLandia

simulators, games, tools, robots

# Products
/stream twitch plays robot plays go
/game jolt physics music game 


# hardware cost
$560
https://www.hiwonder.com/products/nexarm6-axis


- 5 minutes stream per day
fswebcam -r 1920x1080 --no-banner image.jpg
ffmpeg -f v4l2 -framerate 30 -video_size 1920x1080 \
-i /dev/video0 \
-t 5 \
-c:v libx264 \
-preset veryfast \
output.mp4
HappyBearLandia/
  webcam/
    2026-09-11/
      00-00.mp4


# Routes
/blog observable framework
/data downloads bucket
/tool replay analyzer
/edit saves json
/game imports for 3 clients
/ index hosts game
/experiment = single file game
/visualization grid

# how to run locally
bun run dev

# how to deploy

fly deploy

# references
https://www.youtube.com/watch?v=4Tr0otuiQuU&list=RD4Tr0otuiQuU&start_radio=1
