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

async function route(type) {
    var startInput = document.getElementById('start').value;
    var endInput = document.getElementById('end').value;

    let startCoords;
    if (startInput) {
        startCoords = await geocode(startInput);
        if (!startCoords) {
            alert("Could not geocode start location");
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

    var startLat = startCoords[0];
    var startLng = startCoords[1];
    var endLat = endCoords[0];
    var endLng = endCoords[1];

    var osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

    fetch(osrmUrl)
        .then(response => response.json())
        .then(data => {
            if (data.routes && data.routes.length > 0) {
                var routeData = data.routes[0];
                var geometry = L.geoJSON(routeData.geometry);

                if (routeLayer) {
                    map.removeLayer(routeLayer);
                }
                routeLayer = geometry.addTo(map);

                var bounds = geometry.getBounds();
                map.fitBounds(bounds);

                if (startMarker) {
                    map.removeLayer(startMarker);
                }
                startMarker = L.marker([startLat, startLng]).addTo(map);

                if (endMarker) {
                    map.removeLayer(endMarker);
                }
                endMarker = L.marker([endLat, endLng]).addTo(map);

                var instructions = "";
                if (routeData.legs && routeData.legs.length > 0) {
                    routeData.legs[0].steps.forEach(step => {
                        instructions += step.maneuver.instruction + "<br>";
                    });
                }
                document.getElementById('instructions').innerHTML = instructions;

                if (type === 'longest') {
                    calculateLongestRoute(startCoords, endCoords, routeData.distance);
                }

            } else {
                alert("No route found.");
            }
        })
        .catch(error => {
            console.error("Error fetching route:", error);
            alert("Error fetching route.");
        });
}

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

async function calculateLongestRoute(startCoords, endCoords, fastestDistance) {
    const minMultiplier = 2; // Only minimum is 2x
    const maxMultiplier = 100; // Large max for flexibility
    const targetDistance = fastestDistance * (Math.random() * (maxMultiplier - minMultiplier) + minMultiplier);

    async function routeWithWaypoints(waypoints) {
        let coordsString = `${startCoords[1]},${startCoords[0]};`;
        waypoints.forEach(waypoint => {
            coordsString += `${waypoint[1]},${waypoint[0]};`;
        });
        coordsString += `${endCoords[1]},${endCoords[0]}`;

        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

        const response = await fetch(osrmUrl);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            return data.routes[0];
        }
        return null;
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
}