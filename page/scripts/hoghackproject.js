// hoghackproject.js

var map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

var startMarker, endMarker, routeLayer;

function getLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                resolve([position.coords.latitude, position.coords.longitude]);
            }, error => {
                reject(error);
            });
        } else {
            reject("Geolocation is not supported by this browser.");
        }
    });
}

// Display directions on the screen

function displayDirections(legs) {
    const directionsList = document.getElementById('directions-list');
    directionsList.innerHTML = ""; // Clear previous directions

    legs.forEach((leg, legIndex) => {
        leg.steps.forEach((step, stepIndex) => {
            const instruction = step.maneuver.instruction || "Proceed";
            const roadName = step.name || "Unnamed Road";
            const direction = step.maneuver.modifier || ""; // e.g., "left", "right", "straight"
            const distanceMiles = (step.distance * 0.000621371).toFixed(2);

            // Determine the icon based on the maneuver type
            const icon = getDirectionIcon(step.maneuver.modifier);

            // Create a list item with an icon and text
            const listItem = document.createElement('li');
            listItem.innerHTML = `<img src="${icon}" alt="${direction}" style="width: 20px; height: 20px; margin-right: 10px;"> ${instruction} ${direction ? `(${direction})` : ""} onto ${roadName} (${distanceMiles} miles)`;
            directionsList.appendChild(listItem);
        });
    });
}

// Fetch and display route
async function route(type) {
    const startInput = document.getElementById('start').value;
    const endInput = document.getElementById('end').value;

    let startCoords;
    if (startInput) {
        startCoords = await geocode(startInput);
        if (!startCoords) {
            alert("Could not geocode start location.");
            return;
        }
    } else {
        try {
            startCoords = await getLocation();
        } catch (error) {
            alert("Unable to get current location: " + error);
            return;
        }
    }

    const endCoords = await geocode(endInput);
    if (!endCoords) {
        alert("Could not geocode end location.");
        return;
    }

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startCoords[1]},${startCoords[0]};${endCoords[1]},${endCoords[0]}?overview=full&geometries=geojson&steps=true`;

    try {
        const response = await fetch(osrmUrl);
        const data = await response.json();
        console.log(data); // Debugging: Check the API response

        if (data.routes && data.routes.length > 0) {
            const routeData = data.routes[0];
            console.log(routeData.legs); // Debugging: Check the legs structure

            const geometry = L.geoJSON(routeData.geometry);

            if (routeLayer) map.removeLayer(routeLayer);
            routeLayer = geometry.addTo(map);

            map.fitBounds(geometry.getBounds());
            addMarkers(startCoords, endCoords);
            displayDirections(routeData.legs);

            if (type === 'longest') {
                calculateLongestRoute(startCoords, endCoords, routeData.distance);
            }
        } else {
            alert("No route found.");
        }
    } catch (error) {
        console.error("Error fetching route:", error);
        alert("Error fetching route.");
    }
}

// Add markers to the map
function addMarkers(startCoords, endCoords) {
    if (startMarker) map.removeLayer(startMarker);
    startMarker = L.marker(startCoords).addTo(map);

    if (endMarker) map.removeLayer(endMarker);
    endMarker = L.marker(endCoords).addTo(map);
}

// Geocode an address to coordinates
async function geocode(address) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.length > 0) {
            return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        } else {
            return null;
        }
    } catch (error) {
        console.error("Geocoding error:", error);
        return null;
    }
}

// Calculate the longest route (unchanged logic, cleaned up)
async function calculateLongestRoute(startCoords, endCoords, fastestDistance) {
    const minMultiplier = 2;
    const maxAttempts = 20;

    const locations = [
        { name: "Bass Pro Pyramid", coords: [35.1583, -90.0567] },
        { name: "Elvis's House", coords: [35.0494, -90.0241] },
        { name: "Zuckerberg San Francisco General Hospital", coords: [37.7541, -122.4069] },
        { name: "The Cheese Cave", coords: [37.2106, -93.2922] },
        { name: "Walmart in Kodiak Alaska", coords: [57.7900, -152.4073] }
    ];

    const randomLocation = locations[Math.floor(Math.random() * locations.length)];
    const randomLocationCoords = randomLocation.coords;
    const randomLocationName = randomLocation.name;

    async function routeWithWaypoints(waypoints) {
        let coordsString = `${startCoords[1]},${startCoords[0]};`;
        waypoints.forEach(waypoint => {
            coordsString += `${waypoint[1]},${waypoint[0]};`;
        });
        coordsString += `${endCoords[1]},${endCoords[0]}`;

        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson&steps=true`;

        const response = await fetch(osrmUrl);
        const data = await response.json();
        console.log(data); // Debugging: Check the API response

        if (data.routes && data.routes.length > 0) {
            return data.routes[0];
        }
        return null;
    }

    let attempts = 0;
    while (attempts < maxAttempts) {
        const waypoints = [randomLocationCoords];
        const route = await routeWithWaypoints(waypoints);

        if (route && route.distance >= fastestDistance * minMultiplier) {
            const geometry = L.geoJSON(route.geometry);

            if (routeLayer) map.removeLayer(routeLayer);
            routeLayer = geometry.addTo(map);

            map.fitBounds(geometry.getBounds());
            displayDirections(route.legs); // Display directions for the longest route
            return;
        }
        attempts++;
    }
    alert("Could not find a significantly different longer route with " + randomLocationName + ".");
}

    function generateWaypoints(start, end, numWaypoints) {
        const waypoints = [];
        const latDiff = end[0] - start[0];
        const lngDiff = end[1] - start[1];
        const maxDeviation = 0.5; // Increased deviation

        for (let i = 0; i < numWaypoints; i++) {
            const lat = start[0] + latDiff * Math.random();
            const lng = start[1] + lngDiff * Math.random();

            const deviationLat = (Math.random() - 0.5) * maxDeviation * Math.abs(latDiff);
            const deviationLng = (Math.random() - 0.5) * maxDeviation * Math.abs(lngDiff);

            waypoints.push([lat + deviationLat, lng + deviationLng]);
        }
        return waypoints;
    }

    function isRouteValid(routeGeometry) {
        return routeGeometry.coordinates.length > 5;
    }

    let attempts = 0;
    while (attempts < 10) {
        const numWaypoints = Math.floor(Math.random() * 5) + 2;
        const waypoints = generateWaypoints(startCoords, endCoords, numWaypoints);
        const route = await routeWithWaypoints(waypoints);

        if (route && route.distance >= fastestDistance * minMultiplier && isRouteValid(route.geometry)) { //only check minimum.
            const geometry = L.geoJSON(route.geometry);
            if (routeLayer) {
                map.removeLayer(routeLayer);
            }
            routeLayer = geometry.addTo(map);

            const bounds = geometry.getBounds();
            map.fitBounds(bounds);

            let instructions = "";
            if (route.legs && route.legs.length > 0) {
                route.legs.forEach(leg=>{
                  leg.steps.forEach(step => {
                    instructions += step.maneuver.instruction + "<br>";
                  });
                });
            }
            document.getElementById('instructions').innerHTML = instructions;
            return;
        }
        attempts++;
    }
    alert("Could not find a longer route within the specified distance range.");

    // Calculate the longest route (unchanged logic, cleaned up)
async function calculateLongestRoute(startCoords, endCoords, fastestDistance) {
    const minMultiplier = 2;
    const maxAttempts = 20;

    const locations = [
        { name: "Bass Pro Pyramid", coords: [35.1583, -90.0567] },
        { name: "Elvis's House", coords: [35.0494, -90.0241] },
        { name: "Zuckerberg San Francisco General Hospital", coords: [37.7541, -122.4069] },
        { name: "The Cheese Cave", coords: [37.2106, -93.2922] },
        { name: "Walmart in Kodiak Alaska", coords: [57.7900, -152.4073] }
    ];

    const randomLocation = locations[Math.floor(Math.random() * locations.length)];
    const randomLocationCoords = randomLocation.coords;
    const randomLocationName = randomLocation.name;

    async function routeWithWaypoints(waypoints) {
        let coordsString = `${startCoords[1]},${startCoords[0]};`;
        waypoints.forEach(waypoint => {
            coordsString += `${waypoint[1]},${waypoint[0]};`;
        });
        coordsString += `${endCoords[1]},${endCoords[0]}`;

        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson&steps=true`;

        const response = await fetch(osrmUrl);
        const data = await response.json();
        console.log(data); // Debugging: Check the API response

        if (data.routes && data.routes.length > 0) {
            return data.routes[0];
        }
        return null;
    }

    let attempts = 0;
    while (attempts < maxAttempts) {
        const waypoints = [randomLocationCoords];
        const route = await routeWithWaypoints(waypoints);

        if (route && route.distance >= fastestDistance * minMultiplier) {
            const geometry = L.geoJSON(route.geometry);

            if (routeLayer) map.removeLayer(routeLayer);
            routeLayer = geometry.addTo(map);

            map.fitBounds(geometry.getBounds());
            displayDirections(route.legs); // Display directions for the longest route
            return;
        }
        attempts++;
    }
    alert("Could not find a significantly different longer route with " + randomLocationName + ".");
}