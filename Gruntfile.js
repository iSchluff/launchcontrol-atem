module.exports = function(grunt) {
  grunt.initConfig({
    nwjs: {
      options: {
        version: '0.12.3',
        platforms: ['win'],
		    toolbar: 'false',
        buildDir: './build', // Where the build version of my NW.js app is saved
      },
      src: ['./app/**/*'] // Your NW.js app
    },
  });

  grunt.loadNpmTasks('grunt-nw-builder');

  // Define Tasks
  grunt.registerTask("build", ["nwjs"]);
  grunt.registerTask("default", ["build"]);

  grunt.event.on('watch', function(action, filepath, target) {
    grunt.log.writeln(target + ': ' + filepath + ' has ' + action);
  });
};
