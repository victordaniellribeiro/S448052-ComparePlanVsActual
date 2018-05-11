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

		var initDatePicker = Ext.create('Ext.form.field.Date', {
        	fieldLabel: 'From:',
        	listeners : {
        		select: function(picker, date) {
        			//console.log(date);
        			initDate = date.toISOString();
        		}
        	}
        });

        var endDatePicker = Ext.create('Ext.form.field.Date', {
        	fieldLabel: 'To:',
        	listeners : {
        		select: function(picker, date) {
        			//console.log(date);
        			endDate = date.toISOString();
        		}
        	}
        });

        var searchButton = Ext.create('Rally.ui.Button', {
        	text: 'Search',
        	margin: '10 10 10 100',
        	scope: this,
        	handler: function() {
        		//handles search
        		//console.log(initDate, endDate);
        		this._doSearch(initDate, endDate, projectId);
        	}
        });

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
	            type: 'hbox',
	            align: 'stretch',
	            padding: 5
	        },
	        height: 800,
			padding: 5,
			itemId: 'mainPanel',
		});

		this.myMask = new Ext.LoadMask({
		    msg    : 'Please wait...',
		    target : mainPanel
		});

        this.add(datePanel);
        datePanel.down('#filterPanel').add(initDatePicker);
        datePanel.down('#filterPanel').add(endDatePicker);
        datePanel.down('#filterPanel').add(searchButton);

        this.add(mainPanel);
	},

	_doSearch: function(initDate, endDate, projectId) {
		if (initDate == '' || endDate == '') {
    		return;
    	}
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

			listeners: {
				load: function(store, data, success) {
					console.log('Store:', store);
					console.log('Data:', data);

					var projectColumns = [];

					var projectRows = [];

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

							var project = {
								id: projectId,
								name: projectName,
								releases: []
							};

							projectRows[projectId] = project;

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
								}]
							});

							columnNames.push(projectName);
							columnNames.push('plan-'+projectId);
							columnNames.push('actual-'+projectId);

							var releases = record.getCollection('Releases',{
								fetch: ['Name', 'ObjectID', 'Project', 'ReleaseStartDate', 'ReleaseDate', 'PlanEstimate'],
								filters: Rally.data.QueryFilter.and([
									{
										property: 'StartDate',
										operator: '>=',
										value: initDate
									}, {
										property: 'ReleaseDate',
										operator: '<=',
										value: endDate
									}
								])
							});

							console.log('releases', releases);

							if (releases.initialCount > 0) {
								//console.log('project', project, 'releases', releases);

								//wait for every release before working with projects
								var deferred = Ext.create('Deft.Deferred');
								projects.push(deferred);

								console.log('promised project:', project);

								this._loadReleases(project, releases, initDate, endDate).then({
									success: function(records) {
										console.log('Project', records);									
										deferred.resolve(records);
									},
									failure: function(error) {
										console.log('error:', error);
										deferred.reject('error loading project');
									}
								});
							}

						}


					}, this);

					Deft.Promise.all(projects).then({
						success: function(records){
							console.log('all projects:', projects);

							var rows = this._createReportRows(projects);

							console.log('rows', rows);

							//create grid:
							//console.log('p col:', projectColumns);
							//console.log('P data', projectData);

							// var mainPanel = Ext.create('Ext.panel.Panel', {
							// 	title: 'Releases Plan VS Actual',
							// 	layout: {
						 //            type: 'hbox',
						 //            align: 'stretch',
						 //            padding: 5
						 //        },
						 //        height: 800,
							// 	padding: 5,
							// 	itemId: 'mainPanel',
							// });

							var columns = [{
								xtype: 'gridcolumn',
								dataIndex: 'releaseName',
								text: 'Release'
							},
							{
								xtype: 'gridcolumn',
								dataIndex: 'iterationName',
								text: 'Iteration'
							}];

							columns.push.apply(columns,projectColumns);


							var grid = Ext.create('Ext.grid.Panel', {
								columns: columns,
								flex: 1,
								title: 'Projects',
								store: {
									fields: columnNames,
									data: rows
								}
							});
							this.down('#mainPanel').removeAll(true);
							this.down('#mainPanel').add(grid);
							// mainPanel.add(grid);
							// this.add(mainPanel);

							this.myMask.hide();
						},
						failure: function(error) {
							console.log('error:', error);							
						},
						scope: this
					});
				},
				scope: this
			}
		});
	},

	_createReportRows: function(projects){
		//row needs
		var rows = new Ext.util.MixedCollection();

		Ext.Array.each(projects, function(project) {		
			var projectId = project.value.id;
			var projectName = project.value.name;

			//console.log('p', projectName);

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

						//console.log('adding a new row:', row);
						iterations.add(iterationName, row);
						rows.add(releaseName, iterations);
					} else {
						iterations = rows.get(releaseName);
						//itername -> rows

						if (!iterations.containsKey(iterationName)) {							
							row['plan-'+projectId] = plan;
							row['actual-'+projectId] = actual;

							iterations.add(iterationName, row);
						} else {
							var rowlocal = iterations.get(iterationName);

							//console.log('updating row:', row);
							rowlocal['plan-'+projectId] = plan;
							rowlocal['actual-'+projectId] = actual;
						}
					}

				});
			});			

		}, this);

		var iterations = [];

		rows.eachKey(function(releaseName, iterationsMap) {
			iterationsMap.eachKey(function(iterationName, rows) {
				iterations.push(rows);
			});			
		});

		return iterations;
	},

	_loadReleases: function(project, releases, initDate, endDate) {
		var deferred = Ext.create('Deft.Deferred');

		var projectId = project.id;

		var projectFilter = Ext.create('Rally.data.QueryFilter', {
							property: 'project.ObjectID',
							value: projectId,
							operator: '='
						});

		releases.load({
			callback: function(records, operation, success) {
				var promises = [];
				console.log('loading releases', records);

				Ext.Array.each(records, function(release) {
					console.log('release: ', release);
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
							console.log('results:', results);
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
		console.log('loading iterations')

		var deferred = Ext.create('Deft.Deferred');

		Ext.create('Rally.data.wsapi.Store', {
			model: 'Iteration',
			fetch: true,
			autoLoad: true,
			filters: filter,
			sorters: [{
				property: 'StartDate',
				direction: 'ASC'
			}],
			listeners: {
				load: function(store, data, success) {
					//console.log('Store:', store);
					//console.log('Data:', data);

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