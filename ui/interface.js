// See http://www.html5rocks.com/en/tutorials/file/dndfiles/

if (!window.FileReader) alert('no file reader');

function notifyUser(msg) {
    document.getElementById('list').innerHTML = msg;
}

function handleFiles(files, evt) {
    var output = [];
    for (var i = 0, f; f = files[i]; i++) {
	output.push('<li><strong>', escape(f.name), '</strong> (', f.type || 'n/a', ') - ',
		    f.size, ' bytes, last modified: ',
		    f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a',
		    evt ? (' ' + evt.offsetX + ' x ' + evt.offsetY) : '',
		    '</li>');
    }
    notifyUser('<ul>' + output.join('') + '</ul>');

    // In browser/HTML, coordinates start at upper left. We want relative to lower left.
    var coord = '' + evt.offsetX + 'x' + (evt.target.clientHeight - evt.offsetY); 
    notifyUser('sending at ' + coord);
    GetUnity().SendMessage('First Person Controller', 'setImportTarget', coord);

    // Loop through the FileList and render image files as thumbnails.
    for (var i = 0, f; f = files[i]; i++) {

	// Only process image files.
	if (!f.type.match('image.*')) {
	    continue;
	}

	var reader = new FileReader();

	// Closure to capture the file information.
	reader.onload = (function(theFile) {
		return function(e) {
		    // Render thumbnail.
		    var span = document.createElement('span');
		    span.innerHTML = ['<img class="thumb" src="', e.target.result,
				      '" title="', escape(theFile.name), '"/>'].join('');
		    document.getElementById('list').insertBefore(span, null);
		    GetUnity().SendMessage('First Person Controller', 'importImage', e.target.result);
		};
	    })(f);

	// Read in the image file as a data URL.
	reader.readAsDataURL(f);
    }
}

function handleDropSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    handleFiles(evt.dataTransfer.files, evt);
}

function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

// Setup the dnd listeners.
function setup(id) {
    var dropZone = document.getElementById(id);
    dropZone.addEventListener('dragover', handleDragOver, false);
    dropZone.addEventListener('drop', handleDropSelect, false);
}
