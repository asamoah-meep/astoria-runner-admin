export default {
  routes: [
    {
     method: 'GET',
     path: '/meetup/rss',
     handler: 'meetup.rss',
     config: {
       policies: [],
       middlewares: [],
     },
    },
      {
     method: 'GET',
     path: '/meetup/event',
     handler: 'meetup.event',
     config: {
       policies: [],
       middlewares: [],
     },
    },
  ],
};
