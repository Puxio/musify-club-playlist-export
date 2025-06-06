(function() {
    // Selector for the action links (those containing the track's URL)
    const actionLinkSelector = 'div.playlist div.playlist__item div.playlist__actions a[download]';

    // Selector to find artist and track links *within* a playlist__item element.
    const headingLinksRelativeSelector = 'div.playlist__details div.playlist__heading a';

    // CORRECT Selector to find the element containing the duration *within* a playlist__item element.
    const durationElementRelativeSelector = 'div.track__details:not(.track__rating) span.text-muted';

    // Selector for the track position/number *within* a playlist__item element.
    const trackNumberElementRelativeSelector = 'div.playlist__position';

    // Selector for the album header (still used for album title, but not year or artist directly)
    const albumHeaderSelector = 'header.content__title h1';

    // Selector for the album image (still needed to get the URL)
    const albumImageSelector = 'img.album-img';

    // Selector to check if the page is an Album page (and base for itemprop extractions)
    const albumInfoListSelector = 'ul.album-info';


    // --- XML Escaping Helper ---
    const escapeXml = (unsafe) => {
       if (unsafe === null || unsafe === undefined) return '';
       return unsafe.toString().replace(/[<>&'"]/g, function (c) {
           switch (c) {
               case '<': return '&lt;';
               case '>': return '&gt;';
               case '&': return '&amp;';
               case "'": return '&apos;';
               case '"': return '&quot;';
           }
           return '';
       });
    };
    // --- End XML Escaping Helper ---


    // --- Check if it's an Album Page ---
    const albumInfoList = document.querySelector(albumInfoListSelector);
    const isAlbumPage = !!albumInfoList;

    if (isAlbumPage) {
        console.log('Detected page structure is for an Album (found ul.album-info). Image tag will be added at PLAYLIST level.');
    } else {
        console.log('Detected page structure is NOT for an Album (ul.album-info not found). Image tag will NOT be added anywhere.');
    }
    // --- End Check if it's an Album Page ---


    // --- Extract Album Info (Artist, Title, Year) and Image ---
    let albumArtist = 'Unknown Artist';
    let albumTitle = 'Unknown Album';
    let albumYear = 'UnknownYear'; // Default initialization
    let albumImageUrl = null;
    let suggestedFilename = 'playlist.xspf';

    // --- Extract albumArtist using itemprop if it's an album page ---
    if (isAlbumPage) {
        const byArtistElement = document.querySelector(`${albumInfoListSelector} [itemprop=byArtist]`);
        if (byArtistElement) {
            albumArtist = byArtistElement.textContent.trim();
            console.log(`[Album Artist] Found album artist via itemprop: ${albumArtist}`);
        } else {
            console.warn(`[Album Artist] Element with itemprop="byArtist" inside ${albumInfoListSelector} not found. Defaulting to Unknown Artist.`);
        }

        // --- NEW: Extract albumYear using itemprop/sibling if it's an album page ---
        const datePublishedSiblingLink = document.querySelector(`${albumInfoListSelector} [itemprop=datePublished] ~ a`);
        if (datePublishedSiblingLink) {
            const yearText = datePublishedSiblingLink.textContent.trim();
            const yearMatch = yearText.match(/\d{4}/); // Match a 4-digit number (e.g., 1997)
            if (yearMatch && yearMatch[0]) {
                albumYear = yearMatch[0];
                console.log(`[Album Year] Found album year via itemprop sibling: ${albumYear}`);
            } else {
                console.warn(`[Album Year] Element with itemprop="datePublished" ~ a found, but could not extract 4-digit year from "${yearText}". Defaulting to UnknownYear.`);
            }
        } else {
            console.warn(`[Album Year] Element with itemprop="datePublished" ~ a not found. Defaulting to UnknownYear.`);
        }
    }


    // --- OLD LOGIC (modified): Extract albumTitle from header ---
    // This is still useful for filename suggestion and the <album> tag in tracks.
    const albumHeaderElement = document.querySelector(albumHeaderSelector);
    if (albumHeaderElement) {
         const headerText = albumHeaderElement.textContent.trim();
         let potentialTitleText = headerText; // Start with full text

         // If we have an albumArtist from itemprop, and the header starts with it, try to remove it
         // to get a cleaner title.
         if (albumArtist !== 'Unknown Artist' && potentialTitleText.startsWith(albumArtist)) {
            if (potentialTitleText.startsWith(`${albumArtist} - `)) {
                potentialTitleText = potentialTitleText.substring(`${albumArtist} - `.length).trim();
            }
         }

         // If we have an albumYear from itemprop, and the header ends with it, try to remove it.
         // This makes the title extraction more robust.
         if (albumYear !== 'UnknownYear' && potentialTitleText.endsWith(`(${albumYear})`)) {
             potentialTitleText = potentialTitleText.substring(0, potentialTitleText.lastIndexOf(`(${albumYear})`)).trim();
         } else if (albumYear !== 'UnknownYear' && potentialTitleText.endsWith(`${albumYear}`)) { // Less common, but just in case
             potentialTitleText = potentialTitleText.substring(0, potentialTitleText.lastIndexOf(`${albumYear}`)).trim();
         }


         // The remaining potentialTitleText should now be a good candidate for albumTitle.
         albumTitle = potentialTitleText || 'Unknown Album';
         console.log(`[Album Title] Extracted from header: ${albumTitle}`);

         // Construct the suggested filename: artist_dell_album (anno_dell_album) - titolo_dell_album.xspf
         // Ensure albumArtist and albumYear are used here even if they came from itemprop
         suggestedFilename = `${albumArtist} (${albumYear}) - ${albumTitle}.xspf`.replace(/[\\/:*?"<>|]/g, '_');

         console.log(`Suggested filename: ${suggestedFilename}`);

    } else {
         console.warn(`Album header (${albumHeaderSelector}) not found. Cannot suggest filename or populate album tag.`);
    }

    // --- Image URL Extraction (Same as before) ---
    const albumImageElement = document.querySelector(albumImageSelector);
    if (albumImageElement) {
        if (albumImageElement.src) {
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
    const xspfTrackEntries = [];

    console.log('--- Starting XSPF Playlist Extraction ---');

    if (actionAnchorElements.length > 0) {
        actionAnchorElements.forEach(function(actionAnchor, index) {
             if (actionAnchor.href) {
                 const url = actionAnchor.href;

                 let durationInSeconds = -1;
                 let trackTitle = 'Unknown Track';
                 let trackArtist = 'Unknown Artist';
                 let trackNumber = null;


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
                         if (numText !== '') {
                              trackNumber = numText;
                         } else {
                              console.warn(`[Item Index ${index}] ${trackNumberElementRelativeSelector} element found, but text content is empty.`);
                         }
                     } else {
                         console.warn(`[Item Index ${index}] ${trackNumberElementRelativeSelector} element not found for item.`);
                     }
                     // --- End Track Number Extraction ---


                     // --- Construct XSPF <track> Entry ---
                     let trackXml = '    <track>\n';

                     trackXml += `      <location>${escapeXml(url)}</location>\n`;

                     if (durationInSeconds !== -1) {
                         const durationInMilliseconds = durationInSeconds * 1000;
                         trackXml += `      <duration>${durationInMilliseconds}</duration>\n`;
                     } else {
                         console.warn(`[Item Index ${index}] Duration unknown, <duration> tag omitted.`);
                     }

                     if (trackArtist !== 'Unknown Artist') {
                          trackXml += `      <creator>${escapeXml(trackArtist)}</creator>\n`;
                     }

                     if (trackTitle !== 'Unknown Track') {
                          trackXml += `      <title>${escapeXml(trackTitle)}</title>\n`;
                     }

                     // Add album title (from the extracted album info)
                     if (albumTitle !== 'Unknown Album') {
                         trackXml += `      <album>${escapeXml(albumTitle)}</album>\n`;
                     }

                     // --- Conditionally Add Track Image Tag --- (Still removed)
                     // --- End Conditionally Add Track Image Tag ---


                     // --- Add Track Number Tag ---
                     if (trackNumber !== null) {
                          trackXml += `      <trackNum>${escapeXml(trackNumber)}</trackNum>\n`;
                     } else {
                         console.warn(`[Item Index ${index}] <trackNum> tag omitted due to missing/empty position.`);
                     }
                     // --- End Add Track Number Tag ---


                     trackXml += '    </track>';

                     xspfTrackEntries.push(trackXml);

                 } else {
                      console.warn(`[Item Index ${index}] The action link element is not contained within an expected .playlist__item parent.`);
                 }

             } else {
                 console.warn(`[Item Index ${index}] Found an action link element matching the selector but without a valid href attribute.`);
             }
        });


        if (xspfTrackEntries.length > 0) {
            console.log(`Formatted XSPF playlist with ${xspfTrackEntries.length} extracted tracks.`);

            // --- Construct the full XSPF content ---
            let xspfContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xspfContent += '<playlist version="1.0" xmlns="http://xspf.org/ns/0/">\n';

            // --- Add Playlist Location Tag ---
            const pageUrl = location.href;
            if (pageUrl) {
                 xspfContent += `  <location>${escapeXml(pageUrl)}</location>\n`;
            } else {
                 console.warn('Could not get page URL for playlist location tag.');
            }
            // --- End Add Playlist Location Tag ---

            // --- Conditionally Add Playlist Image Tag ---
            if (isAlbumPage && albumImageUrl) {
                xspfContent += `  <image>${escapeXml(albumImageUrl)}</image>\n`;
                console.log('Added playlist-level <image> tag for Album page.');
            } else if (isAlbumPage && !albumImageUrl) {
                 console.warn('Album page detected, but no album image URL found. <image> tag omitted for playlist.');
            } else {
                 console.log('Not an Album page. <image> tag omitted for playlist.');
            }
            // --- End Conditionally Add Playlist Image Tag ---


            xspfContent += '  <trackList>\n';
            xspfContent += xspfTrackEntries.join('\n');
            xspfContent += '\n  </trackList>\n';
            xspfContent += '</playlist>';
            // --- End XSPF content construction ---


            // --- Download the XSPF file ---
            const blob = new Blob([xspfContent], { type: 'application/xspf+xml' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = suggestedFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

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
