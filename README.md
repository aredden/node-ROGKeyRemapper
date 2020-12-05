# Node.js ROG Key Disabler / Remapper

This is a simple project that I will integrate into electron-G14Control, but wanted to make a repository for it as a standalone.

Doesn't really have any requirements other than node.js

The `setUpNewG14ControlKey()` function takes a callback as a property which is called when an ROG keyboard (different from standard keyboard event) event is fired.

The `undoAllRenames()` function can be used to undo the disabling, and then a quick restart will bring back the ArmoryCrate key functionality.

**This also disables most of the Armory Crate GUI functions (though leaves all functionality available via programming interface with ATKWMIACPI.sys) (until undoAllRenames() and a restart has occured)**
