var express = require('express');
var router = express.Router();
var Request = require('../lib/request');
var Ds = require('node-data-structures');
var Set = Ds.Set;
var util = require('../lib/util');

var config = CONFIG;

/**
 * Categorize issues based on milestones and column names.
 * @param issues
 * @param milestones
 * @return Object
 * Refactor this
 * TODO
 */
function _categorizeIssues(issues, milestones) {
  var categorizedIssues =  {};
  var retrospectiveReminders = [];

  for (m in milestones) {
    if (milestones.length == 1 && milestones[0] == 'uncategorized') {
      categorizedIssues[milestones[0]] = {};
    } else {
      categorizedIssues[milestones[m]] = {};
    }

    for(cat in config.boardColumns) {
      categorizedIssues[milestones[m]][config.boardColumns[cat]] = [];
    }
  }

  /**
   * This is repulsive code.
   * Get back to this
   * TODO
   */
  for (var i = 0; i < issues.length; i++) {
    for (m in categorizedIssues) {
      for (cat in config.boardColumns) {
        if (issues[i].milestone && issues[i].milestone.title == m) {
          if (_checkLabelMatches(issues[i], config.boardColumns[cat])) {
            categorizedIssues[m][config.boardColumns[cat]].push(issues[i]);
          }
        }
      }
    }

    if (_checkLabelMatches(issues[i], 'retrospective')) {
      retrospectiveReminders.push(issues[i].title);
    }
  }

  return {
    categorizedIssues: categorizedIssues,
    retrospectiveReminders: retrospectiveReminders
  };
}

/**
 * Check if the labels assigned to an issue
 * match the one we want.
 * @param issue
 * @param label
 * @returns boolean
 */
function _checkLabelMatches(issue, label) {
  for(var i = 0; i < issue.label.length; i++) {
    if (issue.label[i].name == label) {
      return true;
    }
  }
}

router.get('/:user/:repo', function(req, res, next) {
  var repoName = req.params.repo;
  var request = new Request(
    '/repos/'+ config.githubUser + '/'+ repoName + '/issues?state=open&per_page=100',
    'GET',
    {Authorization: 'token ' + req.signedCookies.accessToken},
    null
  );

  request.do(function(error, response, body) {
    if (error) {
      res.render('error', {
        message: error,
        error: {
          status: 500
        }
      });
    }

    if (response.statusCode == 200) {
      var parsedRepos = JSON.parse(body);
      var issueList = [];
      var milestones = new Set();

      for (var i = 0; i < parsedRepos.length; i++) {
        if (parsedRepos[i].labels.length != 0) {
          var issues = {
            issueNumber: parsedRepos[i].number,
            title: parsedRepos[i].title,
            url: parsedRepos[i].html_url,
            assignee: parsedRepos[i].assignee,
            createdAt: parsedRepos[i].created_at,
            label: parsedRepos[i].labels,
            milestone: parsedRepos[i].milestone || {title: 'uncategorized'}
          }

          if (parsedRepos[i].milestone) {
            milestones.add(parsedRepos[i].milestone.title);
          } else {
            milestones.add('uncategorized');
          }

          issueList.push(issues);
        }
      }

      var categorizedIssues = _categorizeIssues(issueList, milestones.getAll());
      var sortedCategorizedIssues = util.sortObject(categorizedIssues.categorizedIssues);

      res.render('board', {
        issues: sortedCategorizedIssues,
        milestones: milestones,
        columns: config.boardColumns,
        pusherKey: config.pusherKey,
        newIssueUrl: 'https://github.com/' + config.githubUser + '/' + repoName + '/issues/new',
        retrospectiveReminders: categorizedIssues.retrospectiveReminders
      });
    } else {
      res.render('error', {
        message: body.message,
        error: {
          status: response.statusCode
        }
      });
    }
  });
});

module.exports = router;
