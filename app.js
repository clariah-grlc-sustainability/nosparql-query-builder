let filterCount = 1;
let valueFilterCount = 1;
let newItems = [];

$(document).ready(function() {
    // Autocompletion for search filter dropdown boxes
    setupAutocomplete('.predicate', 'predicate');
    setupAutocomplete('.object', 'object');
    setupAutocomplete('#show-attribute', 'predicate');

    $('#add-filter').click(function() {
        addSearchFilter();
    });

    $('#add-value-filter').click(function() {
        addValueSearchFilter();
        updateSparqlQuery() 
    });

    $('#execute-query').click(function() {
        executeSparqlQuery();
    });

    $(document).on('change', '.predicate, .object, #show-attribute, #limit-val', function() {
        updateSparqlQuery();
    });

    $(document).on('input', '.predicate, .object, #show-attribute', function() {
        newItems = [];
    });

    // Show or hide side panel
    $('.side-panel').click(function() {
        $('.left').toggleClass('hidden');
        if ($('.left').hasClass('hidden')) {
            $('.side-panel').text('→');
        } else {
            $('.side-panel').text('☰');
        }
    });

    updateSparqlQuery();
});

function setupAutocomplete(selector, type) {
    let page = 0; // Current page number for pagination
    let currentTerm = ''; // Store the current search term

    $(selector).autocomplete({
        source: function(request, response) {
            $(selector).addClass('loading');    // Show loading spinner

            // Check if the search term has changed
            if (currentTerm !== request.term) {
                currentTerm = request.term; // Update to the new term
                page = 0; // Reset to the first page
            }

            fetchSuggestions($('#endpoint-url').val(), type, currentTerm, page, function(items) {
                newItems = items
                $(selector).removeClass('loading'); // Hide loading spinner

                // Add a "More" item to load additional results
                if (newItems.length >= 10) { // Assuming 10 items per page
                    newItems.push({
                        label: "More...",
                        value: "more"
                    });
                }
                response(newItems);
            });
        },
        minLength: 2,
        select: function(event, ui) {
            if (ui.item.value === "more") {
                // Load next set of results
                page++;
                fetchSuggestions($('#endpoint-url').val(), type, currentTerm, page, function(items) {
                    newItems = items;
                    if (newItems.length >= 10) { // If there are more items to load
                        newItems.push({
                            label: "More...",
                            value: "more"
                        });
                    }
                    $(selector).autocomplete("search", currentTerm); // Trigger the autocomplete with the current term
                });
                return false; // Prevent default selection behavior
            } else {
                $(this).val(ui.item.label); // Display the label in the input
                $(this).next('.hidden-uri').val(ui.item.value); // Store the full URI
                return false; // Prevent default selection behavior
            }
        }
    });
}

function fetchSuggestions(endpointUrl, type, term, page, callback) {
    const limit = 30; // Number of suggestions per page
    const offset = page * limit; // Calculate the offset for pagination

    $.ajax({
        url: endpointUrl,
        dataType: 'json',
        data: {
            query: buildAutocompleteQuery(type, term, limit, offset),
            format: 'json'
        },
        success: function(data) {
            const items = parseAutocompleteResults(data, type);
            callback(items);
        }
    });
}

function buildAutocompleteQuery(type, term, limit, offset) {
    if (type === 'predicate') {
        return `
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT DISTINCT ?predicate ?label
            WHERE {
                ?predicate a rdf:Property .
                ?predicate rdfs:label ?label .
                FILTER(regex(?label, "^${term}", "i"))
            }
            LIMIT ${limit}
            OFFSET ${offset}
        `;
    } else if (type === 'object') {
        return `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT DISTINCT ?object ?label
            WHERE {
                ?object rdfs:label ?label .
                FILTER(regex(?label, "^${term}", "i"))
            }
            LIMIT ${limit}
            OFFSET ${offset}
        `;
    }
}

function parseAutocompleteResults(data, type) {
    const bindings = data.results.bindings;
    return bindings.map(binding => ({
        label: binding.label.value,
        value: binding[type].value
    }));
}

function addSearchFilter() {
    const filter = `
        <div class="search-filter">
            <input type="text" id="predicate-${filterCount}" class="predicate" placeholder="Attribute">
            <input type="hidden" class="hidden-uri">
            <input type="text" id="object-${filterCount}" class="object" placeholder="Value">
            <input type="hidden" class="hidden-uri">
            <div class="delete-filter-comp">
                <button class="delete-filter">X</button>
            </div>
        </div>
    `;

    $('#filter-container').append(filter);
    setupAutocomplete(`#predicate-${filterCount}`, 'predicate');
    setupAutocomplete(`#object-${filterCount}`, 'object');
    filterCount++;
}

function addValueSearchFilter() {
    const valueFilter = `
        <div class="value-search-filter">
            <input type="text" id="vpredicate-${valueFilterCount}" class="predicate" placeholder="Predicate">
            <input type="hidden" class="hidden-uri">
            <input type="text" id="min-val-0" class="min-val" placeholder="Min Value">
            <input type="text" id="max-val-0" class="max-val" placeholder="Max Value">
            <div class="dtype-dropdown">
                <select id="datatype-${valueFilterCount}" class="datatype">
                    <option value="xsd:date">Date</option>
                    <option value="xsd:integer">Integer</option>
                    <option value="xsd:decimal">Decimal</option>
                    <option value="xsd:float">Float</option>
                    <option value="xsd:string">String</option>
                </select>
            </div>
            <div class="delete-filter-comp">
                <button class="value-delete-filter">X</button>
            </div>
        </div>
    `;

    $('#value-filter-container').append(valueFilter);
    setupAutocomplete(`#vpredicate-${valueFilterCount}`, 'predicate');
    valueFilterCount++;
}

// Event handler to delete filters
$(document).on('click', '.delete-filter', function() {
    $(this).closest('.search-filter').remove();
    updateSparqlQuery();
});

// Event handler to delete value filters
$(document).on('click', '.value-delete-filter', function() {
    $(this).closest('.value-search-filter').remove();
    updateSparqlQuery();
});

function executeSparqlQuery() {
    const query = $('#sparql-query').text().trim();
    const endpointUrl = $('#endpoint-url').val();
    if (query) {
        $('#results').html('<div class="loader"></div>');   // Show loading spinner

        superagent
            .get(endpointUrl)
            .query({ query: query, format: 'json' })
            .set('Accept', '*/*')
            .then(response => {
                displayResults(response.body);
            })
            .catch(error => {
                $('#results').html('<p>Error executing query.</p>');
                console.error('Error executing query:', error);
            });
    }
}

function displayResults(data) {
    const bindings = data.results.bindings;
    if (bindings.length > 0) {
        let table = '<table><tr>';
        for (const key in bindings[0]) {
            table += `<th>${key}</th>`;
        }
        table += '</tr>';
        let result_idx = 1;
        
        bindings.forEach(binding => {
            table += `<tr>`;
            let first_iteration = true;
            for (const key in binding) {
                if (first_iteration) {
                    table += `<td>${result_idx}. ${binding[key].value}</td>`;
                    first_iteration = false;
                    result_idx++;
                }
                else {
                    table += `<td>${binding[key].value}</td>`;
                    first_iteration = true;
                }   
            }
            table += '</tr>';
        });
        table += '</table>';
        $('#results').html(table);
    } else {
        $('#results').html('<p>No results found.</p>');
    }
}

function updateSparqlQuery() {
    let query = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        
        SELECT ?subject`;

    const showAttribute = $('#show-attribute').next('.hidden-uri').val();

    if (showAttribute) {
        query += ` ?showAttributeVal\r\n`;
    }
    else {
        query += `\r\n`;
    }

    query += `
        WHERE {
    `;

    $('.search-filter').each(function() {
        const predicate = $(this).find('.predicate').next('.hidden-uri').val();
        const object = $(this).find('.object').next('.hidden-uri').val();

        if (predicate && object) {
            query += `
            ?subject <${predicate}> <${object}> .
            `;
        }
    });

    $('.value-search-filter').each(function() {
        const predicate = $(this).find('.predicate').next('.hidden-uri').val();
        const predicateObj = $(this).find('.predicate');
        const datatype = $(this).find('.datatype').val();

        const predicateId = predicateObj.attr('id');
        const numberPart = predicateId.match(/-(\d+)$/)[1];

        const minValue = $(this).find('.min-val').val();
        const maxValue = $(this).find('.max-val').val();

        if (predicate && minValue && maxValue) {
            // Add a filter for range (e.g., date or numeric values)
            query += `
            ?subject <${predicate}> ?value${numberPart} .
            FILTER(?value${numberPart} >= "${minValue}"^^${datatype} && ?value${numberPart} <= "${maxValue}"^^${datatype})
            `;
        }
    });

    if (showAttribute) {
        query += ` 
            ?subject <${showAttribute}> ?showAttributeVal .
        `;
    }

    const limit = $('#limit-val').val();

    if (limit) {
        query += `
        } LIMIT ${limit}`;
    }
    else {
        query += `
        } LIMIT 100`;
    }

    $('#sparql-query').text(query);
}
