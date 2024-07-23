let filterCount = 1;

$(document).ready(function() {
    setupAutocomplete('.predicate', 'predicate');
    setupAutocomplete('.object', 'object');
    setupAutocomplete('#show-attribute', 'predicate');

    $('#add-filter').click(function() {
        addFilterGroup();
    });

    $('#execute-query').click(function() {
        executeSparqlQuery();
    });

    $(document).on('change', '.predicate, .object, #show-attribute, #limit-val', function() {
        updateSparqlQuery();
    });

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
            $.ajax({
                url: endpointUrl,
                dataType: 'json',
                data: {
                    query: buildAutocompleteQuery(type, request.term),
                    format: 'json'
                },
                success: function(data) {
                    const items = parseAutocompleteResults(data, type);
                    response(items);
                }
            });
        },
        minLength: 2
    });
}

function buildAutocompleteQuery(type, term) {
    if (type === 'predicate') {
        return `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT DISTINCT ?predicate ?label
            WHERE {
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
    console.log('data: ', data, ' type: ', type);
    console.log();
    const bindings = data.results.bindings;
    console.log('bindings: ', bindings);
    return bindings.map(binding => {
        return {
            label: binding.label.value,
            value: binding[type].value
        };
    });
}

function addFilterGroup() {
    const filterGroup = `
        <div class="filter-group">
            <input type="text" id="predicate-${filterCount}" class="predicate">
            <input type="text" id="object-${filterCount}" class="object">
        </div>
    `;
    $('#filter-container').append(filterGroup);
    setupAutocomplete(`#predicate-${filterCount}`, 'predicate');
    setupAutocomplete(`#object-${filterCount}`, 'object');
    filterCount++;
}

function updateSparqlQuery() {
    let query = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?subject`;

    const showAttribute = $('#show-attribute').val();
    if (showAttribute) {
        query += ` ?showAttributeVal\r\n`;
    }
    else {
        query += `\r\n`;
    }

    query += `
        WHERE {
    `;

    $('.filter-group').each(function() {
        const predicate = $(this).find('.predicate').val();
        const object = $(this).find('.object').val();
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

function executeSparqlQuery() {
    const query = $('#sparql-query').text().trim();
    const endpointUrl = $('#endpoint-url').val();
    if (query) {
        $.ajax({
            url: endpointUrl,
            dataType: 'json',
            data: {
                query: query,
                format: 'json'
            },
            success: function(data) {
                displayResults(data);
            },
            error: function() {
                $('#results').html('<p>Error executing query.</p>');
            }
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
