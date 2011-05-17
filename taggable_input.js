/*
 * Copyright 2011 James Coleman
 * Licensed under MIT
 *
 *
 * Originally based on:
 * jQuery Plugin: Tokenizing Autocomplete Text Entry
 * Version 1.4.2
 *
 * Copyright (c) 2009 James Smith (http://loopj.com)
 * Licensed jointly under the GPL and MIT licenses,
 * choose which one suits your project best!
 */

(function ($) {
// Default settings
var DEFAULT_SETTINGS = {
  hintText: "Type in a search term",
  noResultsText: "No results",
  searchingText: "Searching...",
  deleteText: "&times;",
  searchDelay: 300,
  minChars: 0,
  tokenLimit: null,
  jsonContainer: null,
  method: "GET",
  contentType: "json",
  queryParam: "q",
  tokenDelimiter: "",
  preventDuplicates: false,
  prePopulateData: null,
  processPrePopulate: true,
  animateDropdown: true,
  'onChange': null,
  tokenStartFlag: '@'
};

// Default classes to use when theming
var DEFAULT_CLASSES = {
  tokenList: "taggable-input-list",
  tokenListFocused: "taggable-input-focus",
  token: "taggable-input-token",
  unstyledToken: "unstyled-token",
  tokenDelete: "taggable-input-delete-token",
  selectedToken: "taggable-input-selected-token",
  highlightedToken: "taggable-input-highlighted-token",
  dropdown: "taggable-input-dropdown",
  dropdownItem: "taggable-input-dropdown-item",
  dropdownItem2: "taggable-input-dropdown-item2",
  selectedDropdownItem: "taggable-input-selected-dropdown-item",
  inputToken: "taggable-input-input-token"
};

// Input box position "enum"
var POSITION = {
  BEFORE: 0,
  AFTER: 1,
  END: 2
};

// Keys "enum"
var KEY = {
  BACKSPACE: 8,
  TAB: 9,
  ENTER: 13,
  ESCAPE: 27,
  SPACE: 32,
  PAGE_UP: 33,
  PAGE_DOWN: 34,
  END: 35,
  HOME: 36,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  DELETE: 46,
  NUMPAD_ENTER: 108,
  COMMA: 188
};


// Expose the .tokenInput function to jQuery as a plugin
$.fn.taggableInput = function (data_source, options) {
  var settings = $.extend({}, DEFAULT_SETTINGS, options || {});

  return this.each(function () {
    new $.TokenList(this, data_source, settings);
  });
};


// TokenList class for each input
$.TokenList = function (input, data_source, settings) {
  //
  // Initialization
  //

  // Configure the data source
  if (typeof(data_source) === "object") {
    // Set the local data to search through
    settings.local_data = data_source;
  } else if ($.isFunction(data_source)) {
    settings.get_data = data_source;
  }

  // Build class names
  if(settings.classes) {
    // Use custom class names
    settings.classes = $.extend({}, DEFAULT_CLASSES, settings.classes);
  } else if(settings.theme) {
    // Use theme-suffixed default class names
    settings.classes = {};
    $.each(DEFAULT_CLASSES, function(key, value) {
      settings.classes[key] = value + "-" + settings.theme;
    });
  } else {
    settings.classes = DEFAULT_CLASSES;
  }


  // Save the tokens
  var saved_tokens = {};

  // Keep track of the number of tokens in the list
  var token_count = 0;

  // Keep track of the timeout, old vals
  var timeout;
  var input_val;
  
  var token_searching_mode = false;

  // Create a new text input and attach keyup events
  var input_box = $("<input type=\"text\"  autocomplete=\"off\">")
    .css({
      outline: "none"
    })
    .focus(function () {
      if (settings.tokenLimit === null || settings.tokenLimit !== token_count) {
        show_dropdown_hint();
      } else {
        $(this).blur();
      }
      if($(input_box).is(":visible")) {
        token_list.addClass(settings.classes.tokenListFocused);
      }
    })
    .blur(function () {
      if(selected_token) {
        deselect_token($(selected_token));
      }
      token_list.removeClass(settings.classes.tokenListFocused);
      hide_dropdown();
    })
    .bind("keyup keydown blur update", resize_input)
    .keydown(function (event) {
      var previous_token;
      var next_token;

      switch(event.keyCode) {
        case KEY.LEFT:
        case KEY.RIGHT:
        case KEY.UP:
        case KEY.DOWN:
          if(!$(this).val()) {
            previous_token = input_token.prev();
            next_token = input_token.next();

            if((previous_token.length && previous_token.get(0) === selected_token) || (next_token.length && next_token.get(0) === selected_token)) {
              // Check if there is a previous/next token and it is selected
              if(event.keyCode === KEY.LEFT || event.keyCode === KEY.UP) {
                deselect_token($(selected_token), POSITION.BEFORE);
              } else {
                deselect_token($(selected_token), POSITION.AFTER);
              }
            } else if((event.keyCode === KEY.LEFT || event.keyCode === KEY.UP) && previous_token.length) {
              if(selected_token) {
                deselect_token($(selected_token));
              }
              // We are moving left, select the previous token if it exists
              var token = $(previous_token.get(0));
              if (token.hasClass(settings.classes.unstyledToken)) {
                select_token(token, true);
                deselect_token(token, POSITION.BEFORE, true);
              } else {
                select_token(token);
              }
            } else if((event.keyCode === KEY.RIGHT || event.keyCode === KEY.DOWN) && next_token.length) {
              if(selected_token) {
                deselect_token($(selected_token));
              }
              // We are moving right, select the next token if it exists
              var token = $(next_token.get(0));
              if (token.hasClass(settings.classes.unstyledToken)) {
                select_token(token, true);
                deselect_token(token, POSITION.AFTER, true);
              } else {
                select_token(token);
              }
            }
          } else {
            var dropdown_item = null;
            
            if(event.keyCode === KEY.DOWN) {
              if (selected_dropdown_item) {
                dropdown_item = $(selected_dropdown_item).next();
              } else {
                dropdown_item = $(dropdown).find('li:first-child');
              }
            } else if(event.keyCode === KEY.UP) {
              if (selected_dropdown_item) {
                dropdown_item = $(selected_dropdown_item).prev();
              } else {
                dropdown_item = $(dropdown).find('li:last-child');
              }
            }
            
            if(dropdown_item) {
              select_dropdown_item(dropdown_item);
            }
            
            if(event.keyCode === KEY.LEFT || event.keyCode === KEY.RIGHT) {
              // we need to allow caret moving here
              return true;
            } else {
              return false;
            }
          }
          break;

        case KEY.BACKSPACE:
          previous_token = input_token.prev();

          if(!$(this).val().length) { // input is empty
            if(selected_token) {
              delete_token($(selected_token));
            } else if(previous_token.length) {
              if (previous_token.hasClass(settings.classes.unstyledToken)) {
                delete_token($(previous_token.get(0)));
              } else {
                select_token($(previous_token.get(0)));
              }
            }

            return false;
          } else if($(this).val().length === 1) {
            hide_dropdown();
          } else {
            // set a timeout just long enough to let this function finish.
            setTimeout(function(){do_search();}, 5);
          }
          break;

        case KEY.DELETE:
          next_token = input_token.next();
          if(!$(this).val().length) {
            if(selected_token) {
              delete_token($(selected_token));
            } else if(next_token.length) {
              select_token($(next_token.get(0)));
            }
          }
        
          break;
        
        case KEY.TAB:
        case KEY.ENTER:
        case KEY.NUMPAD_ENTER:
        case KEY.COMMA:
          
          if(event.keyCode == KEY.TAB && !$(input_box).val().length) {
            hide_dropdown();
            $(this).blur();
            return true;
          }
        
          if(selected_dropdown_item) {
            add_token($.data($(selected_dropdown_item).get(0), "tokeninput"));
          }

        case KEY.ESCAPE:
          hide_dropdown();
          return true;

        default:
          break;
      }
    })
    .keypress(function(event) {
      var character = String.fromCharCode(event.which);
      var val = input_box.val();
      if (!val) {
        token_searching_mode = false;
      }
      
      if (character === settings.tokenStartFlag) {
        token_searching_mode = true;
        setTimeout(function(){do_search();}, 5);
      } else if (token_searching_mode) {
        resize_input(undefined, val + character);
        setTimeout(function(){do_search();}, 5);
      } else {
        add_token({name: character, value: character}, true);
        return false;
      }
      
    });
    
  var unique_counter = 0;
  function get_unique_id() {
    unique_counter++;
    return 'u' + unique_counter;
  }

  // Keep a reference to the original input box
  var hidden_input = $(input)
               .hide()
               .val("")
               .focus(function () {
                 input_box.focus();
               })
               .blur(function () {
                 input_box.blur();
               });

  // Keep a reference to the selected token and dropdown item
  var selected_token = null;
  var selected_token_index = 0;
  var selected_dropdown_item = null;

  // The list to store the token items in
  var token_list = $("<ul />")
    .addClass(settings.classes.tokenList)
    .click(function (event) {
      var li = $(event.target).closest("li");
      if(li && li.get(0) && $.data(li.get(0), "tokeninput")) {
        input_box.focus();
        toggle_select_token(li);
      } else {
        // Deselect selected token
        if(selected_token) {
          deselect_token($(selected_token), POSITION.END);
        }

        // Focus input box
        input_box.focus();
      }
    })
    .mouseover(function (event) {
      var li = $(event.target).closest("li");
      if(li && selected_token !== this) {
        li.addClass(settings.classes.highlightedToken);
      }
    })
    .mouseout(function (event) {
      var li = $(event.target).closest("li");
      if(li && selected_token !== this) {
        li.removeClass(settings.classes.highlightedToken);
      }
    })
    .insertBefore(hidden_input);

  // The token holding the input box
  var input_token = $("<li />")
    .addClass(settings.classes.inputToken)
    .appendTo(token_list)
    .append(input_box);

  // The list to store the dropdown items in
  var dropdown = $("<div>")
    .addClass(settings.classes.dropdown)
    .appendTo("body")
    .hide();

  // Magic element to help us resize the text input
  var input_resizer = $("<tester/>")
    .insertAfter(input_box)
    .css({
      position: "absolute",
      top: -9999,
      left: -9999,
      width: "auto",
      fontSize: input_box.css("fontSize"),
      fontFamily: input_box.css("fontFamily"),
      fontWeight: input_box.css("fontWeight"),
      letterSpacing: input_box.css("letterSpacing"),
      whiteSpace: "nowrap"
    });

  // Pre-populate list if items exist
  hidden_input.val("");
  var data = settings.prePopulateData;
  if(data && data.length) {
    $.each(data, function (index, value) {
      if (value.ignore_style) {
        insert_token(value, true);
      } else {
        insert_token(value, false);
      }
    });
  }



  //
  // Private functions
  //

  function resize_input(event, new_value) {
    new_value = new_value || input_box.val();
    if(input_val === (input_val = new_value)) {return;}

    // Enter new content into resizer and resize input accordingly
    var escaped = new_value.replace(/&/g, '&amp;').replace(/\s/g,' ').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    input_resizer.html(escaped);
    input_box.width(input_resizer.width() + 1);
  }

  function is_printable_character(keycode) {
    return ((keycode >= 48 && keycode <= 90) ||   // 0-1a-z
        (keycode >= 96 && keycode <= 111) ||  // numpad 0-9 + - / * .
        (keycode >= 186 && keycode <= 192) ||   // ; = , - . / ^
        (keycode >= 219 && keycode <= 222));  // ( \ ) '
  }

  // Inner function to a token to the list
  function insert_token(object, ignore_style) {
    var uniqueid = get_unique_id();
    
    var this_token = $("<li><p>"+ object.name +"</p></li>")
      .addClass(settings.classes.token + (ignore_style ? ' ' + settings.classes.unstyledToken : ''))
      .insertBefore(input_token)
      .attr('data-uniqueid', uniqueid);

    // The 'delete token' button
    if (!ignore_style) {
      $("<span>" + settings.deleteText + "</span>") .addClass(settings.classes.tokenDelete)
                                                    .appendTo(this_token)
                                                    .click(function () {
                                                      delete_token($(this).parent());
                                                      return false;
                                                    });
    }

    // Store data on the token
    var token_data = object;
    $.data(this_token.get(0), "tokeninput", token_data);

    // Save this token for duplicate checking
    saved_tokens[uniqueid] = token_data;
    update_hidden_input();
    
    selected_token_index++;

    token_count += 1;
    
    input_box.val('');

    return this_token;
  }

  // Add a token to the token list based on user input
  function add_token (object, ignore_style) {
    token_searching_mode = false;
    
    // Insert the new tokens
    insert_token(object, ignore_style);
  }

  // Select a token in the token list
  function select_token (token, ignore_style) {
    token_searching_mode = false;
    
    if (!ignore_style) { token.addClass(settings.classes.selectedToken); }
    selected_token = token.get(0);

    // Hide input box
    input_box.val("").css('color', 'transparent');

    // Hide dropdown if it is visible (eg if we clicked to select token)
    hide_dropdown();
  }

  // Deselect a token in the token list
  function deselect_token (token, position, ignore_style) {
    token_searching_mode = false;
    
    if (!ignore_style) { token.removeClass(settings.classes.selectedToken); }
    selected_token = null;
    
    input_box.css('color', '');

    if(position === POSITION.BEFORE) {
      input_token.insertBefore(token);
      selected_token_index--;
    } else if(position === POSITION.AFTER) {
      input_token.insertAfter(token);
      selected_token_index++;
    } else {
      input_token.appendTo(token_list);
      selected_token_index = token_count;
    }

    // Show the input box and give it focus again
    input_box.focus();
  }

  // Toggle selection of a token in the token list
  function toggle_select_token(token) {
    var previous_selected_token = selected_token;

    if(selected_token) {
      deselect_token($(selected_token), POSITION.END);
    }

    if(previous_selected_token === token.get(0)) {
      deselect_token(token, POSITION.END);
    } else {
      select_token(token);
    }
  }

  // Delete a token from the token list
  function delete_token (token) {
    token_searching_mode = false;
    
    // Remove the id from the saved list
    var token_data = $.data(token.get(0), "tokeninput");

    var index = token.prevAll().length;
    if(index > selected_token_index) index--;
    
    var uniqueid = $(token).attr('data-uniqueid');
    
    // Delete the token
    token.remove();
    selected_token = null;

    // Show the input box and give it focus again
    input_box.focus().css('color', '');

    // Remove this token from the saved list
    delete saved_tokens[uniqueid];
    update_hidden_input();
    
    if(index < selected_token_index) selected_token_index--;

    token_count -= 1;
  }
  
  // Update the hidden input value
  function update_hidden_input() {
    var token_values = [];
    $.each(saved_tokens, function (index, token) {
      token_values.push(token.value);
    });
    
    hidden_input.val(get_value());
    if ($.isFunction(settings.onChange)) {
      settings.onChange();
    }
  }
  
  function get_value () {
    var token_values = [];
    $.each(saved_tokens, function (index, token) {
      token_values.push(token.value);
    });
    return token_values.join(settings.tokenDelimiter);
  }

  // Hide and clear the results dropdown
  function hide_dropdown () {
    dropdown.hide().empty();
    selected_dropdown_item = null;
  }

  function show_dropdown() {
    dropdown
      .css({
        position: "absolute",
        top: $(token_list).offset().top + $(token_list).outerHeight(),
        left: $(token_list).offset().left,
        zindex: 999
      })
      .show();
  }

  function show_dropdown_searching () {
    if(settings.searchingText) {
      dropdown.html("<p>"+settings.searchingText+"</p>");
      show_dropdown();
    }
  }

  function show_dropdown_hint () {
    if(settings.hintText) {
      dropdown.html("<p>"+settings.hintText+"</p>");
      show_dropdown();
    }
  }
  
  RegExp.escape = function(text) {
    return text.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
  };

  // Highlight the query part of the search term
  function highlight_term(value, term) {
    return value.replace(new RegExp("(?![^&;]+;)(?!<[^<>]*)(" + RegExp.escape(term) + ")(?![^<>]*>)(?![^&;]+;)", "gi"), "<b>$1</b>");
  }

  // Populate the results dropdown with some results
  function populate_dropdown (query, results) {
    if(results && results.length) {
      dropdown.empty();
      var dropdown_ul = $("<ul>")
        .appendTo(dropdown)
        .mouseover(function (event) {
          select_dropdown_item($(event.target).closest("li"));
        })
        .mousedown(function (event) {
          add_token($.data($(event.target).closest("li").get(0), "tokeninput"));
          return false;
        })
        .hide();

      $.each(results, function(index, value) {
        var this_li = $("<li>" + highlight_term(value.name, query) + "</li>")
                  .appendTo(dropdown_ul);

        if(index % 2) {
          this_li.addClass(settings.classes.dropdownItem);
        } else {
          this_li.addClass(settings.classes.dropdownItem2);
        }

        $.data(this_li.get(0), "tokeninput", value);
      });

      show_dropdown();

      if(settings.animateDropdown) {
        dropdown_ul.slideDown("fast");
      } else {
        dropdown_ul.show();
      }
    } else {
      if(settings.noResultsText) {
        dropdown.html("<p>"+settings.noResultsText+"</p>");
        show_dropdown();
      } else {
        hide_dropdown();
      }
    }
  }

  // Highlight an item in the results dropdown
  function select_dropdown_item (item) {
    if(item) {
      if(selected_dropdown_item) {
        deselect_dropdown_item($(selected_dropdown_item));
      }

      item.addClass(settings.classes.selectedDropdownItem);
      selected_dropdown_item = item.get(0);
    }
  }

  // Remove highlighting from an item in the results dropdown
  function deselect_dropdown_item (item) {
    item.removeClass(settings.classes.selectedDropdownItem);
    selected_dropdown_item = null;
  }

  // Do a search and show the "searching" dropdown if the input is longer
  // than settings.minChars
  function do_search() {
    var query = input_box.val().substring(1);

    if((query && query.length) || !settings.minChars) {
      if(selected_token) {
        deselect_token($(selected_token), POSITION.AFTER);
      }

      if((query && query.length >= settings.minChars) || !settings.minChars) {
        show_dropdown_searching();
        clearTimeout(timeout);

        timeout = setTimeout(function(){
          run_search(query);
        }, settings.searchDelay);
      } else {
        hide_dropdown();
      }
    }
  }

  function grep_and_populate_results(query, results) {
    // Do the search through local data
    var results = $.grep(results, function (row) {
      return row.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
    });
    
    populate_dropdown(query, results);
  }

  // Do the actual search
  function run_search(query) {
    // Are we doing an callback search or local data search?
    if(settings.get_data && $.isFunction(settings.get_data)) {
      settings.get_data(function(results, grep_data) {
        if (grep_data) {
          grep_and_populate_results(query, results);
        } else {
          populate_dropdown(query, results);
        }
      });
    } else if(settings.local_data) {
      grep_and_populate_results(query, settings.local_data);
    }
  }
};
}(jQuery));
