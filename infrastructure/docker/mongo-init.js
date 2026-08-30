// MongoDB Initialization Script for ChatLock Local Development
db = db.getSiblingDB('chatlock');

db.createUser({
  user: 'chatlock_user',
  pwd: 'chatlock_user_dev_pass',
  roles: [
    {
      role: 'readWrite',
      db: 'chatlock',
    },
  ],
});

print('MongoDB initialized successfully with chatlock database and user.');
