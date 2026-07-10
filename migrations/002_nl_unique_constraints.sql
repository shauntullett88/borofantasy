-- The sync-* routes upsert on nl_match_id / nl_player_id. Both are nullable
-- (manually-created matches/players have no NL id), and Postgres unique
-- constraints allow multiple NULLs, so this is safe for hand-entered rows.
alter table matches add constraint matches_nl_match_id_key unique (nl_match_id);
alter table players add constraint players_nl_player_id_key unique (nl_player_id);
