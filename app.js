let filterCount = 1;

$(document).ready(function() {
    // Autocompletion for search filter dropdown boxes
    setupAutocomplete('.predicate', 'predicate');
    setupAutocomplete('.object', 'object');
    setupAutocomplete('#show-attribute', 'predicate');

    $('#add-filter').click(function() {
        addSearchFilter();
    });

    $('#execute-query').click(function() {
        executeSparqlQuery();
    });

    $(document).on('change', '.predicate, .object, #show-attribute, #limit-val', function() {
        updateSparqlQuery();
    });

    // Show or hide side panel
    $('#side-panel').click(function() {
        $('#left-pane').toggleClass('hidden');
        if ($('#left-pane').hasClass('hidden')) {
            $('#side-panel').text('→');
        } else {
            $('#side-panel').text('☰');
        }
    });

    updateSparqlQuery();
});

function setupAutocomplete(selector, type) {
    $(selector).autocomplete({
        source: function(request, response) {
            const endpointUrl = $('#endpoint-url').val();
            superagent
                .get(endpointUrl)
                .query({
                    query: buildAutocompleteQuery(type, request.term),
                    format: 'json'
                })
                .set('Accept', '*/*')
                .then(res => {
                    const items = parseAutocompleteResults(res.body, type);
                    response(items);
                })
                .catch(error => {
                    console.error('Error fetching autocomplete results:', error);
                    response([]); // Pass an empty array on error to indicate no results
                });
        },
        minLength: 2,
        select: function(event, ui) {
            $(this).val(ui.item.label); // Set the input box value to the selected item's label
            $(this).next('.hidden-uri').val(ui.item.value); // Store the full IRI in a hidden field
            return false; // Prevent the default action
        }
    });
}

function buildAutocompleteQuery(type, term) {
    if (type === 'predicate') {
        return `
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT DISTINCT ?predicate ?label
            WHERE {
                ?predicate rdf:type rdf:Property .
                ?predicate rdfs:label ?label .
                FILTER(regex(?label, "${term}", "i"))
            }
            LIMIT 10
        `;
    } else if (type === 'object') {
        return `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT DISTINCT ?object ?label
            WHERE {
                ?object rdfs:label ?label .
                FILTER(regex(?label, "${term}", "i"))
            }
            LIMIT 10
        `;
    }
}

function parseAutocompleteResults(data, type) {
    const bindings = data.results.bindings;
    return bindings.map(binding => {
        return {
            label: binding.label.value,
            value: binding[type].value
        };
    });
}

function addSearchFilter() {
    const filter = `
        <div class="search-filter">
            <input type="text" id="predicate-${filterCount}" class="predicate">
            <input type="hidden" class="hidden-uri">
            <input type="text" id="object-${filterCount}" class="object">
            <input type="hidden" class="hidden-uri">
        </div>
    `;

    $('#filter-container').append(filter);
    setupAutocomplete(`#predicate-${filterCount}`, 'predicate');
    setupAutocomplete(`#object-${filterCount}`, 'object');
    filterCount++;
}

function executeSparqlQuery() {
    const query = $('#sparql-query').text().trim();
    const endpointUrl = $('#endpoint-url').val();
    if (query) {
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