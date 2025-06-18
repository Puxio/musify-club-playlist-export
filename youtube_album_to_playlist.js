// Helper function to extract the playlist ID from the current browser URL
function getPlaylistIdFromCurrentUrl() {
  const url = window.location.href; // Get the current page's URL

  // Regex to capture the playlist ID from various YouTube URL formats
  // Examples it captures:
  // - https://www.youtube.com/playlist?list=PLcCUOL3_Hly8RNuTy8lw1CV3wTKdKJuTU
  // - https://m.youtube.com/playlist?list=PLcCUOL3_Hly8RNuTy8lw1CV3wTKdKJuTU
  // - https://www.youtube.com/watch?v=VIDEO_ID&list=PLcCUOL3_Hly8RNuTy8lw1CV3wTKdKJuTU
  const playlistIdMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);

  if (playlistIdMatch && playlistIdMatch[1]) {
    return playlistIdMatch[1]; // Returns the captured playlist ID
  } else {
    console.warn("No playlist ID found in the current URL.");
    return null; // Return null if no ID is found
  }
}

// --- Main Code Block ---
async function getPlaylistVideosAndGenerateXSPF() {
  // Attempt to get the playlist ID from the current page's URL
  const playlistId = getPlaylistIdFromCurrentUrl();

  if (!playlistId) {
    console.error("Cannot proceed: Playlist ID not found in the URL. Ensure you are on a valid YouTube playlist page.");
    return; // Exit the function if no ID is found
  }

  // Choose an Invidious instance. You can find a list here: https://docs.invidious.io/instances/
  const invidiousInstance = 'https://inv.nadeko.net'; 
  const apiUrl = `${invidiousInstance}/api/v1/playlists/${playlistId}`;

  try {
    const response = await fetch(apiUrl);

    // Check if the HTTP request was successful (status 200 OK)
    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status} - Check playlist ID or Invidious instance.`);
    }

    const data = await response.json(); // Parse the response as JSON

    // Check if the playlist contains videos
    if (data.videos && data.videos.length > 0) {
      // Start building the XSPF XML string
      let xspfContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xspfContent += `<playlist version="1" xmlns="http://xspf.org/ns/0/">\n`;
      xspfContent += `  <trackList>\n`;

      data.videos.forEach(video => {
        // Standard YouTube video link format
        const youtubeLink = `https://www.youtube.com/watch?v=${video.videoId}`;
        // Position in the playlist (add +1 to make it 1-based, if available)
        const position = video.index !== undefined ? video.index + 1 : 'N/A';
        const title = video.title || 'Unknown Title';
        const artist = video.author || 'Unknown Artist';
        // Duration in milliseconds for XSPF format
        const duration = video.lengthSeconds !== undefined ? video.lengthSeconds * 1000 : 0; 

        // Append <track> tags with details to the XSPF content
        xspfContent += `    <track>\n`;
        xspfContent += `      <trackNum>${position}</trackNum>\n`;
        xspfContent += `      <title>${escapeXml(title)}</title>\n`;
        xspfContent += `      <creator>${escapeXml(artist)}</creator>\n`;
        xspfContent += `      <location>${escapeXml(youtubeLink)}</location>\n`;
        xspfContent += `      <duration>${duration}</duration>\n`;
        // Thumbnail part was removed as per user's request
        xspfContent += `    </track>\n`;
      });

      xspfContent += `  </trackList>\n`;
      xspfContent += `</playlist>`;

      // Determine the playlist file name
      const playlistTitle = data.title || 'Unknown Playlist';
      const fileName = `${playlistTitle} [Youtube].xspf`;

      // Now, save the XSPF content as a file
      saveXSPFFile(xspfContent, fileName);

      console.log(`XSPF content generated and attempting download as: ${fileName}`);
      console.log('Check your downloads folder.');

    } else {
      console.log('No videos found in this playlist or invalid playlist ID.');
    }

  } catch (error) {
    console.error('An error occurred during playlist retrieval or XSPF generation:', error, '\nEnsure the Invidious instance URL is correct and the playlist ID is valid.');
  }
}

// Helper function to escape special XML characters
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '<';
            case '>': return '>';
            case '&': return '&';
            case '\'': return '&apos;'; // Corrected XML entity for apostrophe
            case '"': return '"';
        }
    });
}

// Function to save the file (remains the same)
function saveXSPFFile(content, fileName) {
    // Create a Blob object with the XML content and correct MIME type
    const blob = new Blob([content], { type: 'application/xspf+xml;charset=utf-8' });

    // Create a temporary URL for the Blob
    const url = URL.createObjectURL(blob);

    // Create a hidden <a> element
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName; // Set the file name for download

    // Simulate a click on the <a> element to trigger the download
    document.body.appendChild(a); // Needed for Firefox
    a.click();

    // Remove the <a> element and revoke the Blob URL to free up memory
    document.body.removeChild(a); // Clean up the DOM
    URL.revokeObjectURL(url); // Important for memory management
}

// --- Launch the function on script execution ---
// This code needs to be executed in a browser context.
// If you're on a YouTube page, you'll likely need a browser extension
// due to security restrictions (CSP and Same-Origin Policy).
getPlaylistVideosAndGenerateXSPF();
