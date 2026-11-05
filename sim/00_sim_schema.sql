-- Sim-only bootstrap: the live project already has these (gossoko schema exposed
-- to the API, PostGIS). Applied before the real migrations on the local stack.
create schema if not exists gossoko;
grant usage on schema gossoko to anon, authenticated, service_role;
alter default privileges in schema gossoko grant all on tables to anon, authenticated, service_role;
alter default privileges in schema gossoko grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema gossoko grant execute on functions to anon, authenticated, service_role;
create extension if not exists postgis schema public;
