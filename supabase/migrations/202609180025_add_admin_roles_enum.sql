-- Migration: 202609180025_add_admin_roles_enum.sql
-- Description: Extend user_role enum with super_admin and sub_admin.
-- PostgreSQL Rule (ERROR 55P04): New enum values must be committed before they can be used in data queries or triggers.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'sub_admin';
