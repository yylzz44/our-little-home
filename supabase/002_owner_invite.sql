-- Run after 001_home.sql, only when the owner's website account is not yet created.
-- Copy the returned 64-character token into your site URL: https://.../#activate=TOKEN
-- Do NOT commit the result or paste it into a public issue.
select home_private.new_invitation(1) as owner_invitation;
