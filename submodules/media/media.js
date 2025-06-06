define(function(require) {
	var $ = require('jquery'),
		_ = require('lodash'),
		monster = require('monster'),
		hideAdd = false,
		miscSettings = {},
		ttsLanguages = {};

	var app = {
		requests: {},

		subscribe: {
			'callflows.fetchActions': 'mediaDefineActions',
			'callflows.media.editPopup': 'mediaPopupEdit',
			'callflows.media.edit': '_mediaEdit',
			'callflows.play.submoduleButtons': 'mediaSubmoduleButtons'
		},

		mediaRender: function(data, target, callbacks) {
			var self = this,
				media_html = $(self.getTemplate({
					name: 'edit',
					data: _.merge({
						hideAdd: hideAdd,
						miscSettings: miscSettings,
						ttsLanguages: ttsLanguages
						//showMediaUploadDisclosure: monster.config.whitelabel.showMediaUploadDisclosure
					}, data),
					submodule: 'media'
				})),
				mediaForm = media_html.find('#media-form'),
				file;

			monster.ui.validate(mediaForm, {
				rules: {
					'name': {
						required: true
					}
				}
			});

			$('*[rel=popover]:not([type="text"])', media_html).popover({
				trigger: 'hover'
			});

			$('*[rel=popover][type="text"]', media_html).popover({
				trigger: 'focus'
			});

			self.winkstartTabs(media_html);

			if (data.data.id) {
				$('#upload_div', media_html).hide();
			}

			$('#change_link', media_html).click(function(ev) {
				ev.preventDefault();
				$('#upload_div', media_html).show();
				$('.player_file', media_html).hide();
			});

			$('#download_link', media_html).click(function(ev) {
				ev.preventDefault();
				window.location.href = self.apiUrl + (self.apiUrl.substring(self.apiUrl.length - 1) !== '/' ? '/' : '')
										+ 'accounts/' + self.accountId + '/media/' + data.data.id
										+ '/raw?auth_token=' + self.getAuthToken();
			});

			$('#file', media_html).bind('change', function(evt) {
				var files = evt.target.files;

				if (files.length > 0) {
					var reader = new FileReader();

					file = 'updating';
					reader.onloadend = function(evt) {
						var data = evt.target.result;

						file = data;
					};

					reader.readAsDataURL(files[0]);
				}
			});

			function changeType($select) {
				var type = $select.val(),
					mediaDisclosure = monster.config.whitelabel.showMediaUploadDisclosure;
					
				$('.media_upload_disclosure', media_html).hide();
			
				if (type === 'tts') {
					$('.tts', media_html).show();
					$('.file', media_html).hide();
				} else if (type === 'upload') {
					$('.tts', media_html).hide();
					$('.file', media_html).show();
					if (mediaDisclosure) {
						$('.media_upload_disclosure', media_html).show();
					}
				}
			}

			changeType($('#media_type', media_html));

			$('#media_type', media_html).change(function() {
				changeType($(this));
			});


			/*
			// set tts languages based on dt-callflows whitelabel configuration
			if(miscSettings.ttsSetLanguages) {

				var ttsVoiceSelect = $('#tts_voice', media_html);
				ttsLanguages.forEach(function(voice) {
					ttsVoiceSelect.append(new Option(voice, voice));
				});

				// if data.tts exists, set the selected option
				if (data.tts && data.tts.voice) {
					ttsVoiceSelect.val(data.tts.voice);
				}

			}
			*/

			// set tts languages based on dt-callflows whitelabel configuration
			if (miscSettings.ttsSetLanguages) {
				var languages = {};
				var voices = {};

				// split the ttsVoices into languages and voices
				ttsLanguages.forEach(function(voice) {
					var parts = voice.split('/');
					var lang = parts[1];

					if (!languages[lang]) {
						languages[lang] = lang;
					}

					if (!voices[lang]) {
						voices[lang] = [];
					}
					voices[lang].push(voice);
				});

				// populate the language dropdown
				var languageSelect = $('#tts_language', media_html);
				for (var lang in languages) {
					languageSelect.append(new Option(lang, lang));
				}

				// populate the voice dropdown based on the selected language
				var voiceSelect = $('#tts_voice', media_html);
				languageSelect.change(function() {
					var selectedLanguage = $(this).val();
					voiceSelect.empty();
					if (voices[selectedLanguage]) {
						voices[selectedLanguage].forEach(function(voice) {
							var gender = voice.split('/')[0]; // extract gender from the voice string
							voiceSelect.append(new Option(gender, gender)); // add the gender to the dropdown
						});
					}
				});

				// set the voice dropdown based on the selected language on form load
				languageSelect.trigger('change');

				// set the initial values if data exists
				if (data.data.tts && data.data.tts.voice) {

					var parts = data.data.tts.voice.split('/'),
						voice = parts[0], // extract the voice part
						language = parts[1], // extract the language part
						ttsVoiceSelect = $('#tts_voice', media_html),
						ttsLanguageSelect = $('#tts_language', media_html);

					// set the values in their respective dropdowns
					ttsVoiceSelect.val(voice);
					ttsLanguageSelect.val(language);

				}
	
			}

			else {

				if (data.data.tts && data.data.tts.voice) {
					var ttsVoiceSelect = $('#tts_voice', media_html);
					ttsVoiceSelect.val(data.data.tts.voice);
				}

			}

			$('.media-save', media_html).click(function(ev) {
				saveButtonEvents(ev);
			});

			$('#submodule-buttons-container .save').click(function(ev) {
				saveButtonEvents(ev);
			});

			function saveButtonEvents(ev) {
				ev.preventDefault();
				var $this = $(this);

				if (!$this.hasClass('disabled')) {
					$this.addClass('disabled');

					if (monster.ui.valid(mediaForm)) {
						var form_data = monster.ui.getFormData('media-form');

						form_data = self.mediaCleanFormData(form_data);

						self.mediaSave(form_data, data, function(_data, status) {
							if (!form_data.tts) {
								if ($('#upload_div', media_html).is(':visible') && $('#file').val() !== '') {
									if (file === 'updating') {
										monster.ui.alert(self.i18n.active().callflows.media.the_file_you_want_to_apply);

										$this.removeClass('disabled');
									} else {
										self.mediaUpload(file, _data.id, function() {
											if (typeof callbacks.save_success === 'function') {
												callbacks.save_success(_data, status);
											}
										}, function() {
											if (data && data.data && data.data.id) {
												self.mediaSave({}, data, function() {
													if (typeof callbacks.save_success === 'function') {
														callbacks.save_success(_data, status);
													}
												});
											} else {
												self.mediaDelete(_data.id, callbacks.delete_success, callbacks.delete_error);
											}

											$this.removeClass('disabled');

											if (typeof callbacks.save_error === 'function') {
												callbacks.save_error(_data, status);
											}
										});
									}
								} else {
									if (typeof callbacks.save_success === 'function') {
										callbacks.save_success(_data, status);
									}
								}
							} else {
								if (typeof callbacks.save_success === 'function') {
									callbacks.save_success(_data, status);
								}		
							}
						});
					} else {
						$this.removeClass('disabled');
						monster.ui.alert(self.i18n.active().callflows.media.there_were_errors_on_the_form);
					}
				}
			};

			$('.media-delete', media_html).click(function(ev) {
				deleteButtonEvents(ev);
			});

			$('#submodule-buttons-container .delete').click(function(ev) {
				deleteButtonEvents(ev);
			});

			function deleteButtonEvents(ev) {
				ev.preventDefault();

				monster.ui.confirm(self.i18n.active().callflows.media.are_you_sure_you_want_to_delete, function() {
					self.mediaDelete(data.data.id, callbacks.delete_success, callbacks.delete_error);
				});
			};

			(target)
				.empty()
				.append(media_html);
		},

		mediaCleanFormData: function(form_data) {
			form_data.description = form_data.upload_media;

			if (form_data.description === '') {
				delete form_data.description;
			}

			if (form_data.media_source === 'tts') {
				
				form_data.description = 'tts file';

				if(miscSettings.ttsSetLanguages) {
					if (form_data.tts && form_data.tts.voice && form_data.tts.language) {
						form_data.tts.voice = form_data.tts.voice + '/' + form_data.tts.language;
						delete form_data.tts.language;
					}
				}

			} else {
				delete form_data.tts;
			}

			delete form_data.media_type;

			return form_data;
		},

		// Added for the subscribed event to avoid refactoring mediaEdit
		_mediaEdit: function(args) {
			var self = this;
			self.mediaEdit(args.data, args.parent, args.target, args.callbacks, args.data_defaults);
		},

		mediaEdit: function(data, _parent, _target, _callbacks, data_defaults) {
			var self = this,
				parent = _parent || $('#media-content'),
				target = _target || $('#media-view', parent),
				_callbacks = _callbacks || {},
				callbacks = {
					save_success: _callbacks.save_success,
					save_error: _callbacks.save_error,
					delete_success: _callbacks.delete_success,
					delete_error: _callbacks.delete_error,
					after_render: _callbacks.after_render
				},
				defaults = {
					data: $.extend(true, {
						streamable: true
					}, data_defaults || {})
				};

			if (miscSettings.callflowButtonsWithinHeader) {
				self.mediaSubmoduleButtons(data);
			};

			if (typeof data === 'object' && data.id) {
				self.mediaGet(data.id, function(mediaData) {
					self.mediaFormatData(mediaData);

					self.mediaRender($.extend(true, defaults, { data: mediaData }), target, callbacks);

					if (typeof callbacks.after_render === 'function') {
						callbacks.after_render();
					}
				});
			} else {
				self.mediaRender(defaults, target, callbacks);

				if (typeof callbacks.after_render === 'function') {
					callbacks.after_render();
				}

				if (miscSettings.callflowButtonsWithinHeader) {
					miscSettings.popupEdit = false;
				}
				
			}
		},

		mediaSave: function(form_data, data, success, error) {
			var self = this,
				normalized_data = self.mediaNormalizeData($.extend(true, {}, data.data, form_data));

			if (typeof data.data === 'object' && data.data.id) {
				self.mediaUpdate(normalized_data, function(_data, status) {
					if (typeof success === 'function') {
						success(_data, status, 'update');
					}
				});
			} else {
				self.mediaCreate(normalized_data, function(_data, status) {
					if (typeof success === 'function') {
						success(_data, status, 'create');
					}
				});
			}
		},

		mediaNormalizeData: function(form_data) {
			delete form_data.upload_media;

			if ('field_data' in form_data) {
				delete form_data.field_data;
			}

			if (form_data.media_source === 'upload') {
				delete form_data.tts;
			}

			return form_data;
		},

		mediaFormatData: function(data) {
			/* On creation, crossbar store streamable as a string, and as a boolean on update
			* And as we're using the same template for both behaviors, we need the same kind of data.
			* TODO: delete once this bug is fixed!
			*/
			if (data.streamable === 'false') {
				data.streamable = false;
			} else if (data.streamable === 'true') {
				data.streamable = true;
			}

			if (data.description !== undefined && data.description.substr(0, 12) === 'C:\\fakepath\\') {
				data.description = data.description.substr(12);
			}

			return data;
		},

		mediaPopupEdit: function(args) {
			var self = this,
				data = args.data,
				callback = args.callback,
				data_defaults = args.data_defaults || {},
				popup,
				popup_html = $('<div class="inline_popup callflows-port"><div class="inline_content main_content"/></div>');

			if (miscSettings.callflowButtonsWithinHeader) {
				miscSettings.popupEdit = true;
			}

			self.mediaEdit(data, popup_html, $('.inline_content', popup_html), {
				save_success: function(_data) {
					popup.dialog('close');

					if (typeof callback === 'function') {
						callback(_data);
					}
				},
				delete_success: function() {
					popup.dialog('close');

					if (typeof callback === 'function') {
						callback({ data: {} });
					}
				},
				after_render: function() {
					popup = monster.ui.dialog(popup_html, {
						title: (data.id) ? self.i18n.active().callflows.media.edit_media : self.i18n.active().callflows.media.create_media
					});
				}
			}, data_defaults);
		},

		mediaDefineActions: function(args) {

			var self = this,
				callflow_nodes = args.actions;

			// set variables for use elsewhere
			hideAdd = args.hideAdd;
			miscSettings = args.miscSettings,
			ttsLanguages = args.ttsLanguages,
			hideCallflowAction = args.hideCallflowAction;

			// function to determine if an action should be listed
			var determineIsListed = function(key) {
				// custom callflow actions
				var customActions = [
					'mailboxMedia[id=*]'
				];

				// if custom callflow actions are disabled
				if (!miscSettings.enableCustomCallflowActions) {
					if (customActions.includes(key)) {
						return false;
					} else {
						return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
					}
				} else {
					return !(hideCallflowAction.hasOwnProperty(key) && hideCallflowAction[key] === true);
				}
			};

			$.extend(callflow_nodes, {
				'play[id=*]': {
					name: self.i18n.active().callflows.media.play_media,
					icon: 'play',
					google_icon: 'library_music', 
					category: self.i18n.active().oldCallflows.basic_cat,
					module: 'play',
					tip: self.i18n.active().callflows.media.play_media_tip,
					data: {
						id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					weight: 10,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							isSilence = id && id === 'silence_stream://300000',
							isShoutcast = id && id.indexOf('://') >= 0 && !isSilence,
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						} else if (isShoutcast) {
							returned_value = id;
						} else if (isSilence) {
							returned_value = self.i18n.active().callflows.media.silence;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this,
							mediaAction = 'play';

						self.mediaList(function(medias) {
							var popup, popup_html,
								mediaId = node.getMetadata('id') || '',
								isSilence = !mediaId || (mediaId && mediaId === 'silence_stream://300000'), // because silence is the default choice, we test for !mediaId
								isShoutcast = mediaId.indexOf('://') >= 0 && mediaId !== 'silence_stream://300000',
								selectedItem = _.find(medias, { id: mediaId });


							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(medias, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: medias,
									resource: 'media',
									resourceId: 'mediaId',
									callback: function(itemNotFound) { 
										renderPopup(itemNotFound);
									}
								});
							} else {
								renderPopup(false);
							}
						
							function renderPopup(itemNotFound) {
								popup_html = $(self.getTemplate({
									name: 'callflowEdit',
									data: {
										items: medias,
										selected: isShoutcast ? 'shoutcast' : mediaId,
										isShoutcast: isShoutcast,
										shoutcastValue: mediaId,
										isEditable: !isShoutcast && !isSilence
									},
									submodule: 'media'
								}));

								var selector = popup_html.find('#media_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Media Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#media_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');
								
								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#media_selector', popup_html).val(),
										streamUrl = $('.shoutcast-url-input', popup_html).val();

									if (selectedValue == 'null' || selectedValue == 'shoutcast' && streamUrl == '') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else if (selectedValue == 'silence_stream://300000') {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).hide();
									} else if (selectedValue == 'shoutcast' && streamUrl != '') {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#media_selector', popup_html).change(toggleSaveButton);
								$('.shoutcast-url-input', popup_html).change(toggleSaveButton);

								if ($('#media_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#media_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.mediaPopupEdit({
										data: _data,
										callback: function(media) {
											node.setMetadata('id', media.id || 'null');
											node.caption = media.name || '';

											popup.dialog('close');
										}
									});
								});

								popup_html.find('#media_selector').on('change', function() {
									var val = $(this).val(),
										isSilence = val && val === 'silence_stream://300000',
										isShoutcast = val === 'shoutcast',
										isEditable = !isShoutcast && !isSilence;

									popup_html.find('#edit_link').toggleClass('active', isEditable);
									popup_html.find('.shoutcast-div').toggleClass('active', isShoutcast).find('input').val('');
								});

								$('#add', popup_html).click(function() {
									var mediaValue = $('#media_selector', popup_html).val(),
										shoutcastValue = $('.shoutcast-url-input', popup_html).val();

									node.caption = mediaValue === 'shoutcast' ? shoutcastValue : $('#media_selector option:selected', popup_html).text();
									mediaValue = mediaValue === 'shoutcast' ? shoutcastValue : mediaValue;
									node.setMetadata('id', mediaValue);

									popup.dialog('close');
								});

								monster.ui.tooltips(popup_html);

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.media.media,
									minHeight: '0',
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						}, mediaAction);
					},
					listEntities: function(callback) {

						var mediaFilters = {
							paginate: false
						};
			
						if (miscSettings.enableCustomCallflowActions && miscSettings.hideMailboxMedia) {
							mediaFilters['filter_not_media_source'] = 'recording';
						}

						self.callApi({
							resource: 'media.list',
							data: {
								accountId: self.accountId,
								filters: mediaFilters
							},
							success: function(data, status) {
								callback && callback(data.data);
							}
						});
					},
					editEntity: 'callflows.media.edit'
				},
				'mailboxMedia[id=*]': {
					name: self.i18n.active().callflows.media.play_mailbox_media,
					icon: 'play',
					google_icon: 'library_music', 
					category: self.i18n.active().oldCallflows.advanced_cat,
					module: 'play',
					tip: self.i18n.active().callflows.media.play_mailbox_media_tip,
					data: {
						id: 'null'
					},
					rules: [
						{
							type: 'quantity',
							maxSize: '1'
						}
					],
					isUsable: 'true',
					isListed: determineIsListed('mailboxMedia[id=*]'),
					weight: 200,
					caption: function(node, caption_map) {
						var id = node.getMetadata('id'),
							isSilence = id && id === 'silence_stream://300000',
							isShoutcast = id && id.indexOf('://') >= 0 && !isSilence,
							returned_value = '';

						if (id in caption_map) {
							returned_value = caption_map[id].name;
						} else if (isShoutcast) {
							returned_value = id;
						} else if (isSilence) {
							returned_value = self.i18n.active().callflows.media.silence;
						}

						return returned_value;
					},
					edit: function(node, callback) {
						var _this = this,
							mediaAction = 'mailboxMedia';

						self.mediaList(function(medias) {
							var popup, popup_html,
								mediaId = node.getMetadata('id') || '',
								isSilence = !mediaId || (mediaId && mediaId === 'silence_stream://300000'), // because silence is the default choice, we test for !mediaId
								isShoutcast = mediaId.indexOf('://') >= 0 && mediaId !== 'silence_stream://300000';

							var selectedId = node.getMetadata('id') || '',
								selectedItem = _.find(medias, { id: selectedId });

							if (!selectedItem && selectedId) {
								self.checkItemExists({
									selectedId: selectedId,
									itemList: medias,
									resource: 'media',
									resourceId: 'mediaId',
									callback: function(itemNotFound) { 
										renderPopup(itemNotFound);
									}
								});
							} else {
								renderPopup(false);
							}

							function renderPopup(itemNotFound) {
								popup_html = $(self.getTemplate({
									name: 'callflowEdit',
									data: {
										items: medias,
										selected: isShoutcast ? 'shoutcast' : mediaId,
										isShoutcast: isShoutcast,
										shoutcastValue: mediaId,
										isEditable: !isShoutcast && !isSilence
									},
									submodule: 'media'
								}));

								var selector = popup_html.find('#media_selector');

								if (itemNotFound) {
									selector.attr("data-placeholder", "Configured Media Not Found").addClass("item-not-found").trigger("chosen:updated");
								}

								selector.on("change", function() {
									if ($(this).val() !== null) {
										$(this).removeClass("item-not-found");
									}
								});

								// add search to dropdown
								popup_html.find('#media_selector').chosen({
									width: '100%',
									disable_search_threshold: 0,
									search_contains: true
								}).on('chosen:showing_dropdown', function() {
									popup_html.closest('.ui-dialog-content').css('overflow', 'visible');
								});

								popup_html.find('.select_wrapper').addClass('dialog_popup');

								// enable or disable the save button based on the dropdown value
								function toggleSaveButton() {
									var selectedValue = $('#media_selector', popup_html).val();
									
									if (selectedValue == 'null') {
										$('#add', popup_html).prop('disabled', true);
										$('#edit_link', popup_html).hide();
									} else {
										$('#add', popup_html).prop('disabled', false);
										$('#edit_link', popup_html).show();
									}
								}

								toggleSaveButton();

								$('#media_selector', popup_html).change(toggleSaveButton);

								if ($('#media_selector option:selected', popup_html).val() === undefined) {
									$('#edit_link', popup_html).hide();
								}

								// hide the add button as we can't add something that is recorded through the handset
								popup_html.find('a.inline_action[data-action="create"]').hide();

								$('.inline_action', popup_html).click(function(ev) {
									var _data = ($(this).data('action') === 'edit') ? { id: $('#media_selector', popup_html).val() } : {};

									ev.preventDefault();

									self.mediaPopupEdit({
										data: _data,
										callback: function(media) {
											node.setMetadata('id', media.id || 'null');
											node.caption = media.name || '';

											popup.dialog('close');
										}
									});
								});

								popup_html.find('#media_selector').on('change', function() {
									var val = $(this).val(),
										isSilence = val && val === 'silence_stream://300000',
										isShoutcast = val === 'shoutcast',
										isEditable = !isShoutcast && !isSilence;

									popup_html.find('#edit_link').toggleClass('active', isEditable);
									popup_html.find('.shoutcast-div').toggleClass('active', isShoutcast).find('input').val('');
								});

								$('#add', popup_html).click(function() {
									var mediaValue = $('#media_selector', popup_html).val(),
										shoutcastValue = $('.shoutcast-url-input', popup_html).val();

									node.caption = mediaValue === 'shoutcast' ? shoutcastValue : $('#media_selector option:selected', popup_html).text();
									mediaValue = mediaValue === 'shoutcast' ? shoutcastValue : mediaValue;
									node.setMetadata('id', mediaValue);

									popup.dialog('close');
								});

								monster.ui.tooltips(popup_html);

								popup = monster.ui.dialog(popup_html, {
									title: self.i18n.active().callflows.media.media,
									minHeight: '0',
									beforeClose: function() {
										if (typeof callback === 'function') {
											callback();
										}
									}
								});
							}
						}, mediaAction);
					},		
					/* commented out so the custom action is not rendered within the menu - can add back in at a later date		
					listEntities: function(callback) {
						self.callApi({
							resource: 'media.list',
							data: {
								accountId: self.accountId,
								filters: {
									paginate: false
								}
							},
							success: function(data, status) {
								callback && callback(data.data);
							}
						});
					},
					*/
					editEntity: 'callflows.media.edit'
				}
			});
		},

		mediaList: function(callback, mediaAction) {
			var self = this;

			var mediaFilters = {
				paginate: false
			};

			if (miscSettings.enableCustomCallflowActions && miscSettings.mediaActionHideMailboxMedia) {
				if (mediaAction == 'play') {
					mediaFilters['filter_not_media_source'] = 'recording';
				}
				if (mediaAction == 'mailboxMedia') {
					mediaFilters['filter_media_source'] = 'recording';
				}
			}
			
			self.callApi({
				resource: 'media.list',
				data: {
					accountId: self.accountId,
					filters: mediaFilters
				},
				success: function(data) {
					var mediaList = _.sortBy(data.data, function(item) { return item.name.toLowerCase(); });

					if (mediaAction != 'mailboxMedia') {
						mediaList.unshift(
							{
								id: 'silence_stream://300000',
								name: self.i18n.active().callflows.media.silence
							},
							{
								id: 'shoutcast',
								name: self.i18n.active().callflows.media.shoutcastURL
							}
						);
					}

					callback && callback(mediaList);
				}
			});
		},

		mediaGet: function(mediaId, callback) {
			var self = this;

			self.callApi({
				resource: 'media.get',
				data: {
					accountId: self.accountId,
					mediaId: mediaId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		mediaCreate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'media.create',
				data: {
					accountId: self.accountId,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		mediaUpdate: function(data, callback) {
			var self = this;

			self.callApi({
				resource: 'media.update',
				data: {
					accountId: self.accountId,
					mediaId: data.id,
					data: data
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		mediaDelete: function(mediaId, callback) {
			var self = this;

			self.callApi({
				resource: 'media.delete',
				data: {
					accountId: self.accountId,
					mediaId: mediaId
				},
				success: function(data) {
					callback && callback(data.data);
				}
			});
		},

		mediaUpload: function(data, mediaId, callback) {
			var self = this;

			self.callApi({
				resource: 'media.upload',
				data: {
					accountId: self.accountId,
					mediaId: mediaId,
					data: data
				},
				success: function(data, status) {
					callback && callback(data, status);
				}
			});
		},

		mediaSubmoduleButtons: function(data) {
			var existingItem = true;
			
			if (!data.id) {
				existingItem = false;
			}
			
			var self = this,
				buttons = $(self.getTemplate({
					name: 'submoduleButtons',
					data: {
						miscSettings: miscSettings,
						existingItem: existingItem,
						hideDelete: hideAdd.play
					}
				}));
			
			$('.entity-header-buttons').empty();
			$('.entity-header-buttons').append(buttons);

			if (!data.id) {
				$('.delete', '.entity-header-buttons').addClass('disabled');
			}
		}
	};

	return app;
});
