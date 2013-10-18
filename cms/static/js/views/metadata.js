define(
    [
        "backbone", "underscore", "js/models/metadata", "js/views/abstract_editor",
        "js/views/transcripts/metadata_videolist", "jquery.maskedinput"
    ],
function(Backbone, _, MetadataModel, AbstractEditor, VideoList) {
    var Metadata = {};

    Metadata.Editor = Backbone.View.extend({

        // Model is CMS.Models.MetadataCollection,
        initialize : function() {
            var tpl = $("#metadata-editor-tpl").text();
            if(!tpl) {
                console.error("Couldn't load metadata editor template");
            }
            this.template = _.template(tpl);

            this.$el.html(this.template({numEntries: this.collection.length}));
            var counter = 0;

            var self = this;
            this.collection.each(
                function (model) {
                    var data = {
                        el: self.$el.find('.metadata_entry')[counter++],
                        model: model
                    };
                    if (model.getType() === MetadataModel.SELECT_TYPE) {
                        new Metadata.Option(data);
                    }
                    else if (model.getType() === MetadataModel.INTEGER_TYPE ||
                        model.getType() === MetadataModel.FLOAT_TYPE) {
                        new Metadata.Number(data);
                    }
                    else if(model.getType() === MetadataModel.LIST_TYPE) {
                        new Metadata.List(data);
                    }
                    else if(model.getType() === MetadataModel.VIDEO_LIST_TYPE) {
                        new VideoList(data);
                    else if(model.getType() === MetadataModel.ISO_TIME_TYPE) {
                        new Metadata.IsoTime(data);
                    }
                    else {
                        // Everything else is treated as GENERIC_TYPE, which uses String editor.
                        new Metadata.String(data);
                    }
                });
        },

        /**
         * Returns the just the modified metadata values, in the format used to persist to the server.
         */
        getModifiedMetadataValues: function () {
            var modified_values = {};
            this.collection.each(
                function (model) {
                    if (model.isModified()) {
                        modified_values[model.getFieldName()] = model.getValue();
                    }
                }
            );
            return modified_values;
        },

        /**
         * Returns a display name for the component related to this metadata. This method looks to see
         * if there is a metadata entry called 'display_name', and if so, it returns its value. If there
         * is no such entry, or if display_name does not have a value set, it returns an empty string.
         */
        getDisplayName: function () {
            var displayName = '';
            this.collection.each(
                function (model) {
                    if (model.get('field_name') === 'display_name') {
                        var displayNameValue = model.get('value');
                        // It is possible that there is no display name value set. In that case, return empty string.
                        displayName = displayNameValue ? displayNameValue : '';
                    }
                }
            );
            return displayName;
        }
    });

    Metadata.String = AbstractEditor.extend({

        events : {
            "change input" : "updateModel",
            "keypress .setting-input" : "showClearButton"  ,
            "click .setting-clear" : "clear"
        },

        templateName: "metadata-string-entry",

        getValueFromEditor : function () {
            return this.$el.find('#' + this.uniqueId).val();
        },

        setValueInEditor : function (value) {
            this.$el.find('input').val(value);
        }
    });

    Metadata.Number = AbstractEditor.extend({

        events : {
            "change input" : "updateModel",
            "keypress .setting-input" : "keyPressed",
            "change .setting-input" : "changed",
            "click .setting-clear" : "clear"
        },

        render: function () {
            AbstractEditor.prototype.render.apply(this);
            if (!this.initialized) {
                var numToString = function (val) {
                    return val.toFixed(4);
                };
                var min = "min";
                var max = "max";
                var step = "step";
                var options = this.model.getOptions();
                if (options.hasOwnProperty(min)) {
                    this.min = Number(options[min]);
                    this.$el.find('input').attr(min, numToString(this.min));
                }
                if (options.hasOwnProperty(max)) {
                    this.max = Number(options[max]);
                    this.$el.find('input').attr(max, numToString(this.max));
                }
                var stepValue = undefined;
                if (options.hasOwnProperty(step)) {
                    // Parse step and convert to String. Polyfill doesn't like float values like ".1" (expects "0.1").
                    stepValue = numToString(Number(options[step]));
                }
                else if (this.isIntegerField()) {
                    stepValue = "1";
                }
                if (stepValue !== undefined) {
                    this.$el.find('input').attr(step, stepValue);
                }

                // Manually runs polyfill for input number types to correct for Firefox non-support.
                // inputNumber will be undefined when unit test is running.
                if ($.fn.inputNumber) {
                    this.$el.find('.setting-input-number').inputNumber();
                }

                this.initialized = true;
            }

            return this;
        },

        templateName: "metadata-number-entry",

        getValueFromEditor : function () {
            return this.$el.find('#' + this.uniqueId).val();
        },

        setValueInEditor : function (value) {
            this.$el.find('input').val(value);
        },

        /**
         * Returns true if this view is restricted to integers, as opposed to floating points values.
         */
        isIntegerField : function () {
            return this.model.getType() === 'Integer';
        },

        keyPressed: function (e) {
            this.showClearButton();
            // This first filtering if statement is take from polyfill to prevent
            // non-numeric input (for browsers that don't use polyfill because they DO have a number input type).
            var _ref, _ref1;
            if (((_ref = e.keyCode) !== 8 && _ref !== 9 && _ref !== 35 && _ref !== 36 && _ref !== 37 && _ref !== 39) &&
                ((_ref1 = e.which) !== 45 && _ref1 !== 46 && _ref1 !== 48 && _ref1 !== 49 && _ref1 !== 50 && _ref1 !== 51
                    && _ref1 !== 52 && _ref1 !== 53 && _ref1 !== 54 && _ref1 !== 55 && _ref1 !== 56 && _ref1 !== 57)) {
                e.preventDefault();
            }
            // For integers, prevent decimal points.
            if (this.isIntegerField() && e.keyCode === 46) {
                e.preventDefault();
            }
        },

        changed: function () {
            // Limit value to the range specified by min and max (necessary for browsers that aren't using polyfill).
            var value = this.getValueFromEditor();
            if ((this.max !== undefined) && value > this.max) {
                value = this.max;
            } else if ((this.min != undefined) && value < this.min) {
                value = this.min;
            }
            this.setValueInEditor(value);
            this.updateModel();
        }

    });

    Metadata.Option = AbstractEditor.extend({

        events : {
            "change select" : "updateModel",
            "click .setting-clear" : "clear"
        },

        templateName: "metadata-option-entry",

        getValueFromEditor : function () {
            var selectedText = this.$el.find('#' + this.uniqueId).find(":selected").text();
            var selectedValue;
            _.each(this.model.getOptions(), function (modelValue) {
                if (modelValue === selectedText) {
                    selectedValue = modelValue;
                }
                else if (modelValue['display_name'] === selectedText) {
                    selectedValue = modelValue['value'];
                }
            });
            return selectedValue;
        },

        setValueInEditor : function (value) {
            // Value here is the json value as used by the field. The choice may instead be showing display names.
            // Find the display name matching the value passed in.
            _.each(this.model.getOptions(), function (modelValue) {
                if (modelValue['value'] === value) {
                    value = modelValue['display_name'];
                }
            });
            this.$el.find('#' + this.uniqueId + " option").filter(function() {
                return $(this).text() === value;
            }).prop('selected', true);
        }
    });

    Metadata.List = AbstractEditor.extend({

        events : {
            "click .setting-clear" : "clear",
            "keypress .setting-input" : "showClearButton",
            "change input" : "updateModel",
            "input input" : "enableAdd",
            "click .create-setting" : "addEntry",
            "click .remove-setting" : "removeEntry"
        },

        templateName: "metadata-list-entry",

        getValueFromEditor: function () {
            return _.map(
                this.$el.find('li input'),
                function (ele) { return ele.value.trim(); }
            ).filter(_.identity);
        },

        setValueInEditor: function (value) {
            var list = this.$el.find('ol');
            list.empty();
            _.each(value, function(ele, index) {
                var template = _.template(
                    '<li class="list-settings-item">' +
                        '<input type="text" class="input" value="<%= ele %>">' +
                        '<a href="#" class="remove-action remove-setting" data-index="<%= index %>"><i class="icon-remove-sign"></i><span class="sr">Remove</span></a>' +
                    '</li>'
                );
                list.append($(template({'ele': ele, 'index': index})));
            });
        },

        addEntry: function(event) {
            event.preventDefault();
            // We don't call updateModel here since it's bound to the
            // change event
            var list = this.model.get('value') || [];
            this.setValueInEditor(list.concat(['']));
            this.$el.find('.create-setting').addClass('is-disabled');
        },

        removeEntry: function(event) {
            event.preventDefault();
            var entry = $(event.currentTarget).siblings().val();
            this.setValueInEditor(_.without(this.model.get('value'), entry));
            this.updateModel();
            this.$el.find('.create-setting').removeClass('is-disabled');
        },

        enableAdd: function() {
            this.$el.find('.create-setting').removeClass('is-disabled');
        }
    });

    Metadata.IsoTime = Metadata.AbstractEditor.extend({

        events : {
            "change input" : "updateModel",
            "keypress .setting-input" : "showClearButton"  ,
            "click .setting-clear" : "clear"
        },

        templateName: "metadata-string-entry",

        initialize: function () {
            Metadata.AbstractEditor.prototype.initialize.apply(this);

            // This list of definitions is used for creating appropriate
            // time format mask;
            //
            // For example, mask 'hH:mM:sS':
            // min value: 00:00:00
            // max value: 23:59:59
            //
            // With this mask user cannot set following values:
            // 93:23:23, 23:60:60, 77:77:77, etc.
            var definitions = {
                h: '[0-2]',
                H: '[0-3]',
                m: '[0-5]',
                s: '[0-5]',
                M: '[0-9]',
                S: '[0-9]'
            };

            $.each(definitions, function(key, value) {
                $.mask.definitions[key] = value;
            });

            this.$el
                .find('#' + this.uniqueId)
                .mask('hH:mM:sS', { placeholder: '0' });
        },

        getValueFromEditor : function () {
            var $input = this.$el.find('#' + this.uniqueId),
                value = $input.val();

            return value;
        },

        setValueInEditor : function (value) {
            if (!value) {
                value = '00:00:00';
            }

            this.$el.find('input').val(value);
        }
    });

    return Metadata;
});
