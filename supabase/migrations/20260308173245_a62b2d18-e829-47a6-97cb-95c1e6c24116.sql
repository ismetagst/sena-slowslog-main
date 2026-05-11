
-- Clean up contentEditable div wrappers in all story content
-- Replace <div><br></div> with <br> and <div>...</div> with ...<br>
UPDATE public.stories
SET content = regexp_replace(
  regexp_replace(
    regexp_replace(
      content,
      '<div><br\s*/?></div>', '<br>', 'gi'
    ),
    '</div><div>', '<br>', 'gi'
  ),
  '</?div>', '', 'gi'
)
WHERE content IS NOT NULL AND content LIKE '%<div%';
