UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/m4a',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/x-aac',
  'audio/aacp',
  'audio/mp4a-latm',
  'audio/3gpp'
]
WHERE id = 'whisper-audio';