Auth-Gated App Testing Playbook

Step 1: Create Test User & Session
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  neighborhood: '',
  contact_preference: 'email',
  notification_preferences: {email: true, push: true, sms: false},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"

Step 2: Test Backend API
curl -X GET "https://your-app.com/api/auth/me" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
curl -X GET "https://your-app.com/api/dashboard" -H "Authorization: Bearer YOUR_SESSION_TOKEN"

Step 3: Browser Testing
Set the `session_token` cookie for the preview domain, then navigate to `/`.

Checklist
- User document has `user_id`, not app-visible Mongo `_id`.
- Session `user_id` matches user exactly.
- API returns user data with `user_id`.
- Dashboard loads without redirect.