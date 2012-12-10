// Turns off mouse look when the mouse leaves the player.
// Attach this script to a GUITexture that covers the player, but which has no texture.
public var looks:MouseLook[];
function trackMouseMotion(enabled:boolean) {
	for (var script:MouseLook in looks) script.enabled = enabled;
}

// Note that iPhone doesn't have OnMouse<mumble>.
function OnMouseEnter() { trackMouseMotion(true); }
function OnMouseDown() { trackMouseMotion(true); }

function OnMouseExit() { trackMouseMotion(false); }
function Update() {
	if (Input.GetKeyUp(KeyCode.Escape)) trackMouseMotion(false);
}