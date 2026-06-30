create table if not exists issue_comments (
  id uuid default gen_random_uuid() primary key,
  issue_id uuid references issues(id) on delete cascade,
  user_id text,
  user_email text,
  comment_text text not null,
  created_at timestamptz default now()
);
