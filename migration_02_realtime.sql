-- Enable Realtime for the IncomingPhotos table so the dashboard updates instantly
ALTER PUBLICATION supabase_realtime ADD TABLE "IncomingPhotos";
