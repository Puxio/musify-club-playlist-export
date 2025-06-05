(function() {
    // Selector for the action links (those containing the track's URL)
    const actionLinkSelector = 'div.playlist div.playlist__item div.playlist__actions a';

    // Selector to find artist and track links *within* a playlist__item element.
    const headingLinksRelativeSelector = 'div.playlist__details div.playlist__heading a';

    // CORRECT Selector to find the element containing the duration *within* a playlist__item element.
    const durationElementRelativeSelector = 'div.track__details:not(.track__rating) span.text-muted';

    // Selector for the track position/number *within* a playlist__item element.
    const trackNumberElementRelativeSelector = 'div.playlist__position';

    // Selector for the album header
    const albumHeaderSelector = 'header.content__title h1';

    // Selector for the album image (still needed to get the URL)
    const albumImageSelector = 'img.album-img';

    // Selector to check if the page is an Album page
    const albumInfoListSelector = 'ul.album-info';


    // --- XML Escaping Helper ---
    // Function to escape characters that have special meaning in XML
    const escapeXml = (unsafe) => {
       if (unsafe === null || unsafe === undefined) return ''; // Handle null or undefined
       return unsafe.toString().replace(/[<>&'"]/g, function (c) {
           switch (c) {
               case '<': return '&lt;';
               case '>': return '&gt;';
               case '&': return '&amp;';
               case "'": return '&apos;';
               case '"': return '&quot;';
           }
           return ''; // Should not happen
       });
    };
    // --- End XML Escaping Helper ---


    // --- Check if it's an Album Page ---
    const albumInfoList = document.querySelector(albumInfoListSelector);
    const isAlbumPage = !!albumInfoList; // true if element found, false otherwise

    if (isAlbumPage) {
        console.log('Detected page structure is for an Album (found ul.album-info). Image tag will be added to EACH TRACK.');
    } else {
        console.log('Detected page structure is NOT for an Album (ul.album-info not found). Image tag will be added to the PLAYLIST level.');
    }
    // --- End Check if it's an Album Page ---


    // --- Extract Album Info and Image (for filename suggestion and XSPF tags) ---
    // This logic runs once before processing tracks.
    // Album image URL is extracted REGARDLESS of isAlbumPage, as it might be needed for playlist level.
    let albumArtist = 'Unknown Artist';
    let albumTitle = 'Unknown Album';
    let albumYear = 'UnknownYear';
    let albumImageUrl = null; // Variable to store the album image URL
    let suggestedFilename = 'playlist.xspf'; // Default fallback filename for XSPF

    const albumHeaderElement = document.querySelector(albumHeaderSelector);
    const albumImageElement = document.querySelector(albumImageSelector); // Find the album image element REGARDLESS of page type


    if (albumHeaderElement) {
         const headerText = albumHeaderElement.textContent.trim();
         // Expected format: "Artist - Title (Year)"
         const yearMatch = headerText.match(/\((\d{4})\)$/); // Regex to find (YYYY) at the end

         let textBeforeYear = headerText;

         if (yearMatch && yearMatch[1]) {
             year = yearMatch[1]; // The captured year (e.g., "1997")
             // Remove the year part from the main string
             textBeforeYear = headerText.substring(0, yearMatch.index).trim();
             albumYear = year; // Set the albumYear variable
         } else {
             console.warn(`[Album Info] Could not find (YYYY) year pattern at the end of "${headerText}".`);
         }

         // Now parse "Artist - Title" from textBeforeYear
         const separatorIndex = textBeforeYear.lastIndexOf(' - '); // Use lastIndexOf in case title has " - "

         if (separatorIndex > 0) {
             albumArtist = textBeforeYear.substring(0, separatorIndex).trim();
             albumTitle = textBeforeYear.substring(separatorIndex + 3).trim(); // +3 for " - "
         } else {
             // No " - " found, use the whole part as the album title
             albumTitle = textBeforeYear || albumTitle; // Use the whole part if not empty
             console.warn(`[Album Info] Could not find " - " separator in "${textBeforeYear}".`);
         }

         // Construct the suggested filename: artist_dell_album (anno_dell_album) - titolo_dell_album.xspf
         // Replace characters invalid for filenames with underscores
         suggestedFilename = `${albumArtist} (${albumYear}) - ${albumTitle}.xspf`.replace(/[\\/:*?"<>|]/g, '_');

         console.log(`Suggested filename: ${suggestedFilename}`);

    } else {
         console.warn(`Album header (${albumHeaderSelector}) not found. Cannot suggest filename or populate album tag.`);
    }

    // --- Image URL Extraction (Now happens regardless of isAlbumPage) ---
    if (albumImageElement) {
        if (albumImageElement.src) {
            // Get the absolute image URL from the src property
            albumImageUrl = albumImageElement.src;
            console.log(`[Album Image] Found potential album image URL: ${albumImageUrl}`);
        } else {
             console.warn(`[Album Image] Album image element (${albumImageSelector}) found, but src attribute is empty.`);
        }
    } else {
        console.warn(`[Album Image] Album image element (${albumImageSelector}) not found.`);
    }
    // --- End Image URL Extraction ---
    // --- End Extract Album Info and Image ---


    const actionAnchorElements = document.querySelectorAll(actionLinkSelector);
    // This array will store the XML string for each <track> element
    const xspfTrackEntries = [];

    console.log('--- Starting XSPF Playlist Extraction ---'); // Updated log message

    if (actionAnchorElements.length > 0) {
        actionAnchorElements.forEach(function(actionAnchor, index) {
             if (actionAnchor.href) {
                 const url = actionAnchor.href; // The URL is in the action link

                 let durationInSeconds = -1; // Start with unknown duration (in seconds)
                 let trackTitle = 'Unknown Track'; // Default fallback track title
                 let trackArtist = 'Unknown Artist'; // Default fallback track artist
                 let trackNumber = null; // Default fallback track number (null means tag will be omitted)


                 // Risali l'albero del DOM per trovare l'elemento genitore .playlist__item
                 const playlistItem = actionAnchor.closest('.playlist__item');

                 if (playlistItem) {
                     // --- Duration Extraction ---
                     const durationElement = playlistItem.querySelector(durationElementRelativeSelector);

                     if (durationElement) {
                         const durationText = durationElement.textContent.trim();
                         const timeParts = durationText.split(':');

                         if (timeParts.length === 2) {
                             const minutes = parseInt(timeParts[0], 10);
                             const seconds = parseInt(timeParts[1], 10);

                             if (!isNaN(minutes) && !isNaN(seconds)) {
                                 durationInSeconds = (minutes * 60) + seconds;
                                 if (durationInSeconds < 0) durationInSeconds = -1;
                             } else {
                                 console.warn(`[Item Index ${index}] Could not convert minutes/seconds "${durationText}" to numbers.`);
                             }
                         } else {
                             console.warn(`[Item Index ${index}] Unexpected duration format "${durationText}" (atteso MM:SS).`);
                         }
                     } else {
                         console.warn(`[Item Index ${index}] Duration element (${durationElementRelativeSelector}) not found in item.`);
                     }
                     // --- End Duration Extraction ---


                     // --- Title Extraction (Artist & Track) ---
                     const headingLinks = playlistItem.querySelectorAll(headingLinksRelativeSelector);

                     if (headingLinks.length >= 2) {
                         const artistElement = headingLinks[0];
                         const trackElement = headingLinks[1];

                         trackArtist = artistElement.textContent.trim() || 'Unknown Artist';
                         trackTitle = trackElement.textContent.trim() || 'Unknown Track';
                     } else {
                          console.warn(`[Item Index ${index}] Could not find the two Artist/Track links in the item's heading.`);
                     }
                     // --- End Title Extraction ---

                     // --- Track Number Extraction ---
                     const trackNumElement = playlistItem.querySelector(trackNumberElementRelativeSelector);

                     if (trackNumElement) {
                         const numText = trackNumElement.textContent.trim();
                         if (numText !== '') { // Only use the text if it's not empty
                              trackNumber = numText; // Store the string value
                         } else {
                              console.warn(`[Item Index ${index}] ${trackNumberElementRelativeSelector} element found, but text content is empty.`);
                         }
                     } else {
                         console.warn(`[Item Index ${index}] ${trackNumberElementRelativeSelector} element not found for item.`);
                     }
                     // --- End Track Number Extraction ---


                     // --- Construct XSPF <track> Entry ---
                     // Build the XML string for this single track
                     let trackXml = '    <track>\n'; // Indented for readability

                     // Add location (URL), escaping special characters
                     trackXml += `      <location>${escapeXml(url)}</location>\n`;

                     // Add duration in milliseconds if known
                     if (durationInSeconds !== -1) {
                         const durationInMilliseconds = durationInSeconds * 1000;
                         trackXml += `      <duration>${durationInMilliseconds}</duration>\n`;
                     } else {
                         console.warn(`[Item Index ${index}] Duration unknown, <duration> tag omitted.`);
                     }

                     // Add creator (track artist), escaping special characters
                     if (trackArtist !== 'Unknown Artist') {
                          trackXml += `      <creator>${escapeXml(trackArtist)}</creator>\n`;
                     }

                     // Add title (track title), escaping special characters
                     if (trackTitle !== 'Unknown Track') {
                          trackXml += `      <title>${escapeXml(trackTitle)}</title>\n`;
                     }

                     // Add album title (from the extracted album info, assuming it applies to all tracks)
                     // This is added regardless of isAlbumPage, as it's part of the track metadata if found
                     if (albumTitle !== 'Unknown Album') {
                         trackXml += `      <album>${escapeXml(albumTitle)}</album>\n`;
                     }

                     // --- Conditionally Add Track Image Tag ---
                     // Add the image tag *only if* it's an album page AND an album image URL was found
                     if (isAlbumPage && albumImageUrl) {
                          trackXml += `      <image>${escapeXml(albumImageUrl)}</image>\n`; // Add the tag, escaped and indented
                     } else if (isAlbumPage && !albumImageUrl) {
                          // Warning already issued during initial extraction if image not found on album page
                     } // else if !isAlbumPage, image is handled at playlist level
                     // --- End Conditionally Add Track Image Tag ---


                     // --- Add Track Number Tag ---
                     if (trackNumber !== null) { // Only add the tag if a number was successfully extracted
                          trackXml += `      <trackNum>${escapeXml(trackNumber)}</trackNum>\n`;
                     } else {
                         console.warn(`[Item Index ${index}] <trackNum> tag omitted due to missing/empty position.`);
                     }
                     // --- End Add Track Number Tag ---


                     trackXml += '    </track>'; // Closing track tag

                     xspfTrackEntries.push(trackXml); // Add the XML string for this track to the array

                 } else {
                      console.warn(`[Item Index ${index}] The action link element is not contained within an expected .playlist__item parent.`);
                      // No track entry added if parent not found
                 }

             } else {
                 // Case: Found an action anchor, but without a valid href attribute
                 console.warn(`[Item Index ${index}] Found an action link element matching the selector but without a valid href attribute.`);
             }
        }); // end forEach


        if (xspfTrackEntries.length > 0) {
            console.log(`Formatted XSPF playlist with ${xspfTrackEntries.length} extracted tracks.`);

            // --- Construct the full XSPF content ---
            let xspfContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xspfContent += '<playlist version="1.0" xmlns="http://xspf.org/ns/0/">\n';

            // --- Add Playlist Location Tag --- (Keep this)
            const pageUrl = location.href; // Get the current page URL
            if (pageUrl) {
                 xspfContent += `  <location>${escapeXml(pageUrl)}</location>\n`; // Add the tag, escaped and indented
            } else {
                 console.warn('Could not get page URL for playlist location tag.');
            }
            // --- End Add Playlist Location Tag ---

            // --- Conditionally Add Playlist Image Tag ---
            // Add the image tag *only if* it's NOT an album page AND an album image URL was found
            if (!isAlbumPage && albumImageUrl) {
                xspfContent += `  <image>${escapeXml(albumImageUrl)}</image>\n`; // Add the tag, escaped and indented
                console.log('Added playlist-level <image> tag.'); // Informative log
            } else if (!isAlbumPage && !albumImageUrl) {
                 console.warn('Playlist page detected, but no album image URL found. <image> tag omitted for playlist.');
            } // else if isAlbumPage, image is handled at track level
            // --- End Conditionally Add Playlist Image Tag ---


            // Optional: Add playlist title from album info (still removed as per previous request)


            xspfContent += '  <trackList>\n';

            // Join the individual track XML strings with a newline separator
            xspfContent += xspfTrackEntries.join('\n');

            xspfContent += '\n  </trackList>\n'; // Add a newline before closing trackList tag for last track
            xspfContent += '</playlist>';
            // --- End XSPF content construction ---


            // --- Download the XSPF file ---
            const blob = new Blob([xspfContent], { type: 'application/xspf+xml' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = suggestedFilename; // Use the suggested filename
            document.body.appendChild(a); // Append to body (can be invisible)
            a.click(); // Programmatically click the link to trigger download
            document.body.removeChild(a); // Clean up the element
            URL.revokeObjectURL(url); // Release the object URL

            console.log(`XSPF file "${suggestedFilename}" downloaded successfully.`);
            // --- End Download ---

        } else {
             console.warn('No valid XSPF tracks created. Verify the HTML structure and the presence of href, duration, and heading.');
        }
    } else {
        console.warn(`No action link element found with the initial selector:\n${actionLinkSelector}`);
    }
    console.log('--- End Processing ---');
})();
