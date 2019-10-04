Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',
	launch: function() {
		//Write app code here

		//API Docs: https://help.rallydev.com/apps/2.1/doc/
		var context = this.getContext();
		var projectId = context.getProject()['ObjectID'];

		var initDate = '';
        var endDate = '';

		console.log('Project:', projectId);

		// var initDatePicker = Ext.create('Ext.form.field.Date', {
  //       	fieldLabel: 'From:',
  //       	listeners : {
  //       		select: function(picker, date) {
  //       			//console.log(date);
  //       			initDate = date.toISOString();
  //       		}
  //       	}
  //       });

        // var endDatePicker = Ext.create('Ext.form.field.Date', {
        // 	fieldLabel: 'To:',
        // 	listeners : {
        // 		select: function(picker, date) {
        // 			//console.log(date);
        // 			endDate = date.toISOString();
        // 		}
        // 	}
        // });

        var releaseComboBox = Ext.create('Rally.ui.combobox.ReleaseComboBox',{
        	itemId : 'releaseComboBox',
			multiSelect: true,
			// defaultSelectionPosition: 'clear',
        	listeners : {
        		select: function(combobox, records) {
        			console.log('combo:', combobox);
        			console.log('records ', records);
        			var releaseNames = [];
        			if (records) {
        				for (var i = records.length - 1; i >= 0; i--) {
        					releaseNames.push(records[i].get('Name'));
        				}
        				this._doSearch(null, null, projectId, releaseNames);

        			}   			
        		},
        		ready: function(combobox) {
        			console.log('combo:', combobox);
        			console.log('this:', this);

        			// var startDate = combobox.valueModels[0].get('ReleaseStartDate');
        			// var endDate = combobox.valueModels[0].get('ReleaseDate');
        			var releaseNames = [];
        			releaseNames.push(combobox.valueModels[0].get('Name'));

        			this._doSearch(null, null, projectId, releaseNames);
        		},
        		scope: this
	        }

        });

        // var searchButton = Ext.create('Rally.ui.Button', {
        // 	text: 'Search',
        // 	margin: '10 10 10 100',
        // 	scope: this,
        // 	handler: function() {
        // 		//handles search
        // 		//console.log(initDate, endDate);
        // 		this._doSearch(initDate, endDate, projectId);
        // 	}
        // });

        var datePanel = Ext.create('Ext.panel.Panel', {
            layout: 'hbox',
            align: 'stretch',
            padding: 5,
            itemId: 'datePanel',
            items: [
                {
	                xtype: 'panel',
	                flex: 1,
	                itemId: 'filterPanel'
                }
            ]
                       
        });

        var mainPanel = Ext.create('Ext.panel.Panel', {
			title: 'Releases Plan VS Actual',
			layout: {
	            type: 'vbox',
	            align: 'stretch',
	            padding: 5
	        },
	        //height: 800,
			padding: 5,
			itemId: 'mainPanel',
		});

		this.myMask = new Ext.LoadMask({
		    msg    : 'Please wait...',
		    target : mainPanel
		});

        this.add(datePanel);
        datePanel.down('#filterPanel').add(releaseComboBox);
        //datePanel.down('#filterPanel').add(initDatePicker);
        //datePanel.down('#filterPanel').add(endDatePicker);
        // datePanel.down('#filterPanel').add(searchButton);

        this.add(mainPanel);
	},

	_doSearch: function(initDate, endDate, projectId, releaseNames) {
		console.log(releaseNames);
		// if (initDate == '' || endDate == '') {
  //   		return;
  //   	}
		this.myMask.show();

		Ext.create('Rally.data.wsapi.Store', {
			model: 'Project',
			autoLoad: true,
			context: {
				projectScopeUp: false,
				projectScopeDown: true,
				project: null //null to search all workspace
			},

			filters: Rally.data.QueryFilter.or([{
				property: 'parent.ObjectID',
				value: projectId
			}, {
				property: 'parent.parent.ObjectID',
				value: projectId
			}]),

			// filters: [ {
			// 	property: 'ObjectID',
			// 	value: '217318192996'
			// }],
			sorters: [{
				property: 'Name',
				direction: 'ASC'
			}],

			fetch: ['Description', 'Name', 'ObjectID', 'Children', 'Releases', 'Iterations'],
			limit: Infinity,

			listeners: {
				load: function(store, data, success) {
					//console.log('Store:', store);
					console.log('Data:', data);

					if (!data || data.length == 0) {
						//should only work with parent projects
						var messagePanel = Ext.create('Ext.panel.Panel', {
							flex: 1,
							title: 'No child team found. This report should run on top level teams' ,
						});

						this.down('#mainPanel').removeAll();

						this.down('#mainPanel').add(messagePanel);

						this.myMask.hide();

					} else {
						var projectColumns = [];

						//var projectRows = [];

						var columnNames = ['releaseName', 'iterationName'];

						var projects = [];

						_.each(data, function(record) {
							//console.log('Releases:', record.get('Releases'));
							//we have all projects:
							//console.log('Project name:', record.get('Name'), record.get('Children'));

							//only projects children
							if (record.get('Children').Count == 0) {
								var projectId = record.get('ObjectID');
								var projectName = record.get('Name');
								//need to cleanup project names
								projectName = projectName.replace(/\(/g, '' );
								projectName = projectName.replace(/\)/g, '' );
								projectName = projectName.replace(/\[/g, '' );
								projectName = projectName.replace(/\]/g, '' );
								projectName = projectName.replace(/\./g, '' );

								var project = {
									id: projectId,
									name: projectName,
									releases: []
								};

								//projectRows[projectId] = project;

								projectColumns.push({
									xtype: 'gridcolumn',
									dataIndex: projectName,
									text: projectName,
									columns: [{
										text: 'Plan',
										dataIndex: 'plan-'+projectId
									}, {
										text: 'Actual',
										dataIndex: 'actual-'+projectId
									}, {
										text: 'Throughput',
										dataIndex: 'throughtput-'+projectId,
										renderer : function(value, meta) {
										    if (parseInt(value) >= 100) {
										        meta.style = "background-color:#cdf9c2; color: #090";
										    } else {
										        meta.style = "background-color:#ffe2e2; color: #900";
										    }
										    return value;
										}
									}]
								});

								columnNames.push(projectName);
								columnNames.push('plan-'+projectId);
								columnNames.push('actual-'+projectId);
								columnNames.push('throughtput-'+projectId);

								var releaseFilter = this._createReleasesFilter(releaseNames);							

								var releaseStore = Ext.create('Rally.data.WsapiDataStore', {
									model: 'Release',
									context: {
								        projectScopeUp: false,
								        projectScopeDown: true,
								        project: '/project/'+projectId
									},
									fetch: ['Name', 'ObjectID', 'Project', 'ReleaseStartDate', 'ReleaseDate', 'PlanEstimate'],
									limit: Infinity,
									filters: releaseFilter
									//autoLoad: true,
								});

								// console.log('releases', releases);
								//console.log('project', project, 'releases', releases);

								//wait for every release before working with projects
								var deferred = Ext.create('Deft.Deferred');
								projects.push(deferred);

								//console.log('promised project:', project);

								this._loadReleases(project, releaseStore, initDate, endDate).then({
									success: function(records) {
										//console.log('Project', records);									
										deferred.resolve(records);
									},
									failure: function(error) {
										//console.log('error:', error);
										deferred.reject('error loading project');
									}
								});
							}


						}, this);

						Deft.Promise.all(projects).then( {
							success: function(records) {
								console.log('all projects:', projects);

								var rows = this._createReportRows(projects);

								//console.log('rows', rows);

								this.down('#mainPanel').removeAll(true);

								//for each release create a panel, then create a grid with all iterations
								rows.eachKey(function(releaseName, iterationsMap) {
									var columns = [{
										xtype: 'gridcolumn',
										dataIndex: 'iterationName',
										text: 'Iteration',
										width: 150
									}];


									columns.push.apply(columns, projectColumns);

									var iterations = [];

									iterationsMap.eachKey(function(iterationName, rows) {
										iterations.push(rows);
									});	

									//console.log('columns', columns);
									//console.log('columnNames:', columnNames);
									//console.log('data iterations:', iterations);


									var grid = Ext.create('Ext.grid.Panel', {
										columns: columns,
										flex: 1,
										title: 'Release: ' + releaseName,
										store: {
											fields: columnNames,
											data: iterations
										}
									});


									//console.log('grid', grid);

									this.down('#mainPanel').add(grid);							
								}, 
								this);
								

								this.myMask.hide();
							},
							failure: function(error) {
								console.log('error:', error);							
							},
							scope: this
						});
					}
				},
				scope: this
			}
		});
	},


	_createReleasesFilter: function(releases) {
		var filter = undefined;

		if (releases.length == 1) {
			filter = {
		        property: 'Name',
		        operator: '=',
		        value: releases[0]
		    };
		} else if (releases.length == 2) {
			filter = Rally.data.wsapi.Filter.or([
			    {
			        property: 'Name',
			        operator: '=',
			        value: releases[0]
			    },
			    {
			        property: 'Name',
			        operator: '=',
			        value: releases[1]
			}]);
		} else if (releases.length > 2) {
			filter = Rally.data.wsapi.Filter.or([
			    {
			        property: 'Name',
			        operator: '=',
			        value: releases[0]
			    },
			    {
			        property: 'Name',
			        operator: '=',
			        value: releases[1]
			}]);

			releases = _.last(releases, releases.length - 2);
			//console.log('after last:', milestonesTag);

			for (var name of releases) {
				filter = Rally.data.wsapi.Filter.or([
				    filter,
				    {
				        property: 'Name',
				        operator: '=',
				        value: name
					}]);
			}
		}

		return filter;
	},


	_createReportRows: function(projects) {
		console.log('creating rows');
		//row needs
		var rows = new Ext.util.MixedCollection();


		Ext.Array.each(projects, function(project) {		
			var projectId = project.value.id;
			var projectName = project.value.name;

			var tempIterationCount = 0;

			//console.log('row p', projectName);

			Ext.Array.each(project.value.releases, function(release) {
				var releaseId = release.id;		
				var releaseName = release.name;
				var startDate = release.startDate;
				var endDate = release.endDate;

				Ext.Array.each(release.iterations, function(iteration) {
					var iterationId = iteration.id;
					var iterationName = iteration.name;
					var iterationStartDate = iteration.startDate;
					var iterationEndDate = iteration.endDate;
					var plan = iteration.plan;
					var actual = iteration.actual;
					var throughtput = Math.round(actual / plan * 100);

					var row = {
						iterationId: iterationId,
						iterationName: iterationName,
						releaseName: releaseName
					};

					var iterations;

					if (!rows.containsKey(releaseName)) {
						iterations = new Ext.util.MixedCollection();
						row['plan-'+projectId] = plan;
						row['actual-'+projectId] = actual;
						row['throughtput-'+projectId] = throughtput;

						//console.log('adding a new row:', row);
						iterations.add(iterationName, row);
						rows.add(releaseName, iterations);
					} else {
						iterations = rows.get(releaseName);
						//itername -> rows

						if (!iterations.containsKey(iterationName)) {							
							row['plan-'+projectId] = plan;
							row['actual-'+projectId] = actual;
							row['throughtput-'+projectId] = throughtput;

							iterations.add(iterationName, row);
						} else {
							var rowlocal = iterations.get(iterationName);

							//console.log('updating row:', row);
							rowlocal['plan-'+projectId] = plan;
							rowlocal['actual-'+projectId] = actual;
							rowlocal['throughtput-'+projectId] = throughtput;
						}
					}
				});
			});			

		}, this);

		//map  containing releases -> iterations
		return rows;
	},


	_loadReleases: function(project, releases, initDate, endDate) {
		var deferred = Ext.create('Deft.Deferred');

		var projectId = project.id;

		var projectFilter = Ext.create('Rally.data.QueryFilter', {
							property: 'project.ObjectID',
							value: projectId,
							operator: '='
						});

		releases.load().then({
			success: function(records, operation, success) {
				var promises = [];
				console.log('loading releases', records);

				Ext.Array.each(records, function(release) {
					//console.log('release: ', release);
					//gather all iterations using start/end date and project ID
					var startDateFilter = Ext.create('Rally.data.QueryFilter', {
						property: 'StartDate',
						value: release.get('ReleaseStartDate'),
						operator: '>='
					});

					var endDateFilter = Ext.create('Rally.data.QueryFilter', {
						property: 'EndDate',
						value: release.get('ReleaseDate'),
						operator: '<='
					});


					var filter = startDateFilter.and(endDateFilter).and(projectFilter);

					var releaseId = release.get('ObjectID');
					var r = {
						id: releaseId,
						name: release.get('Name'),
						startDate: release.get('ReleaseStartDate'),
						endDate: release.get('ReleaseDate'),
						iterations: []
					};

					project.releases.push(r);

					promises.push(this._loadIterations(r, filter));

				}, this);


				if (records.length == 0) {
					deferred.resolve(project);
				} else {
					Deft.Promise.all(promises).then({
						success: function(results) {
							console.log('releases results:', results);
							//Ext.Array.each(results, function(result) {
								//console.log('project.releases', project.releases);

							//});
							//console.log('trecho final.')						
							deferred.resolve(project);
						},
						failure: function(error) {
							console.log('error:', error);
							deferred.reject('error loading release');
						}
					});
				}

				//console.log('Final project Object:', project);
				
			},
			scope: this
		});

		return deferred.promise;

	},

	_loadIterations: function(release, filter) {
		//console.log('Release', release);
		console.log('loading iterations for release', release);

		var deferred = Ext.create('Deft.Deferred');

		Ext.create('Rally.data.wsapi.Store', {
			model: 'Iteration',
			fetch: ['ObjectID', 'Name', 'StartDate', 'EndDate', 'PlannedVelocity', 'PlanEstimate'],
			context: {
				projectScopeUp: false,
				projectScopeDown: true,
				project: null //null to search all workspace
			},
			autoLoad: true,
			filters: filter,
			limit: Infinity,
			sorters: [{
				property: 'StartDate',
				direction: 'ASC'
			}],
			listeners: {
				load: function(store, data, success) {
					//console.log('Store:', store);
					//console.log('iterations loaded:', data);

					_.each(data, function(record) {
						var iteration = {
							id: record.get('ObjectID'),
							name: record.get('Name'),
							startDate: record.get('StartDate'),
							endDate: record.get('EndDate'),
							plan: record.get('PlannedVelocity'),
							actual: record.get('PlanEstimate')
						};

						//console.log('itearation', iteration);
						release.iterations.push(iteration);
					});

					deferred.resolve(release);
				}
			}
		});

		return deferred.promise;
	}
});