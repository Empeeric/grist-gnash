var Step = require('step')
  fs = require('fs');

/**
 * An example showing the information returned by indexInformation
 *
 * @_class cursor
 * @_function toArray
 */
exports.shouldCorrectlyExecuteToArray = function(configuration, test) {
  var db = configuration.newDbInstance({w:1}, {poolSize:1, auto_reconnect:false});

  // DOC_LINE var db = new Db('test', new Server('locahost', 27017));
  // DOC_START
  // Establish connection to db
  db.open(function(err, db) {

    // Create a collection to hold our documents
    db.createCollection('test_array', function(err, collection) {

      // Insert a test document
      collection.insert({'b':[1, 2, 3]}, {w:1}, function(err, ids) {

        // Retrieve all the documents in the collection
        collection.find().toArray(function(err, documents) {
          test.equal(1, documents.length);
          test.deepEqual([1, 2, 3], documents[0].b);

          db.close();
          test.done();
        });
      });
    });
  });
  // DOC_END
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyExecuteToArrayAndFailOnFurtherCursorAccess = function(configuration, test) {
  var client = configuration.db();

  client.createCollection('test_to_a', function(err, collection) {

    collection.insert({'a':1}, {w:1}, function(err, ids) {
      var cursor = collection.find({});
      cursor.toArray(function(err, items) {
        // Should fail if called again (cursor should be closed)
        cursor.toArray(function(err, items) {
          test.equal("Cursor is closed", err.message);

          // Should fail if called again (cursor should be closed)
          cursor.each(function(err, item) {
            test.equal("Cursor is closed", err.message);
            // Let's close the db
            test.done();
          });
        });
      });
    });
  });
}

/**
 * A simple example iterating over a query using the each function of the cursor.
 *
 * @_class cursor
 * @_function each
 * @ignore
 */
exports.shouldCorrectlyFailToArrayDueToFinishedEachOperation = function(configuration, test) {
  var db = configuration.newDbInstance({w:1}, {poolSize:1, auto_reconnect:false});

  // DOC_LINE var db = new Db('test', new Server('locahost', 27017));
  // DOC_START
  // Establish connection to db
  db.open(function(err, db) {

    // Create a collection
    db.createCollection('test_to_a_after_each', function(err, collection) {
      test.equal(null, err);

      // Insert a document in the collection
      collection.insert({'a':1}, {w:1}, function(err, ids) {

        // Grab a cursor
        var cursor = collection.find();

        // Execute the each command, triggers for each document
        cursor.each(function(err, item) {

          // If the item is null then the cursor is exhausted/empty and closed
          if(item == null) {

            // Show that the cursor is closed
            cursor.toArray(function(err, items) {
              test.ok(err != null);

              // Let's close the db
              test.done();
              db.close();
            });
          };
        });
      });
    });
  });
  // DOC_END
}

/**
 * @ignore
 * @api private
 */
/* REASON: Explain is not supported
exports.shouldCorrectlyExecuteCursorExplain = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_explain', function(err, collection) {
    collection.insert({'a':1}, {w:1}, function(err, r) {
      collection.find({'a':1}).explain(function(err, explaination) {
        test.ok(explaination.cursor != null);
        test.ok(explaination.n.constructor == Number);
        test.ok(explaination.millis.constructor == Number);
        test.ok(explaination.nscanned.constructor == Number);

        // Let's close the db
        test.done();
      });
    });
  });
}
*/

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyExecuteCursorCount = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_count', function(err, collection) {
    collection.find().count(function(err, count) {
      test.equal(0, count);

      Step(
        function insert() {
          var group = this.group();

          for(var i = 0; i < 10; i++) {
            collection.insert({'x':i}, {w:1}, group());
          }
        },

        function finished() {
          collection.find().count(function(err, count) {
            test.equal(10, count);
            test.ok(count.constructor == Number);
          });

          collection.find({}, {'limit':5}).count(function(err, count) {
            test.equal(5, count); // REASON: was 10 for mongo db, but for optimization we didn't find more than required
          });

          collection.find({}, {'skip':5}).count(function(err, count) {
            test.equal(5, count); // REASON: was 10 for mongo db, but for optimization we didn't find more than required
          });

          var cursor = collection.find();
          cursor.count(function(err, count) {
            test.equal(10, count);

            cursor.each(function(err, item) {
              if(item == null) {
                cursor.count(function(err, count2) {
                  test.equal(10, count2);
                  test.equal(count, count2);
                  // Let's close the db
                  test.done();
                });
              }
            });
          });

          client.collection('acollectionthatdoesn').count(function(err, count) {
            test.equal(0, count);
          });
        }
      )
    });
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyExecuteSortOnCursor = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_sort', function(err, collection) {
    Step(
      function insert() {
        var group = this.group();

        for(var i = 0; i < 5; i++) {
          collection.insert({'a':i}, {w:1}, group());
        }
      },

      function finished() {
        collection.find().sort(['a', 1], function(err, cursor) {
          test.deepEqual(['a', 1], cursor.sortValue);
        });

        collection.find().sort('a', 1).nextObject(function(err, doc) {
          test.equal(0, doc.a);
        });

        collection.find().sort('a', -1).nextObject(function(err, doc) {
          test.equal(4, doc.a);
        });

        collection.find().sort('a', "asc").nextObject(function(err, doc) {
          test.equal(0, doc.a);
        });

        collection.find().sort([['a', -1], ['b', 1]], function(err, cursor) {
          test.deepEqual([['a', -1], ['b', 1]], cursor.sortValue);
        });

        collection.find().sort('a', 1).sort('a', -1).nextObject(function(err, doc) {
          test.equal(4, doc.a);
        });

        collection.find().sort('a', -1).sort('a', 1).nextObject(function(err, doc) {
          test.equal(0, doc.a);
        });

        var cursor = collection.find();
        cursor.nextObject(function(err, doc) {
          cursor.sort(['a'], function(err, cursor) {
            test.equal("Cursor is closed", err.message);
          });
        });

        collection.find().sort('a', 25).nextObject(function(err, doc) {
          test.equal("Illegal sort clause, must be of the form [['field1', '(ascending|descending)'], ['field2', '(ascending|descending)']]", err.message);
        });

        collection.find().sort(25).nextObject(function(err, doc) {
          test.equal("Illegal sort clause, must be of the form [['field1', '(ascending|descending)'], ['field2', '(ascending|descending)']]", err.message);
          // Let's close the db
          test.done();
        });
      }
    );
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyThrowErrorOnToArrayWhenMissingCallback = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_to_array', function(err, collection) {
    Step(
      function insert() {
        var group = this.group();

        for(var i = 0; i < 2; i++) {
          collection.save({'x':1}, {w:1}, group());
        }
      },

      function finished() {
        collection.find(function(err, cursor) {
          test.throws(function () {
            cursor.toArray();
          });
          test.done();
        });
      }
    )
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldThrowErrorOnEachWhenMissingCallback = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_each', function(err, collection) {
    Step(
      function insert() {
        var group = this.group();

        for(var i = 0; i < 2; i++) {
          collection.save({'x':1}, {w:1}, group());
        }
      },

      function finished() {
        collection.find(function(err, cursor) {
          test.throws(function () {
            cursor.each();
          });
          test.done();
        });
      }
    )
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyHandleLimitOnCursor = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_cursor_limit', function(err, collection) {
    Step(
      function insert() {
        var group = this.group();

        for(var i = 0; i < 10; i++) {
          collection.save({'x':1}, {w:1}, group());
        }
      },

      function finished() {
        collection.find().count(function(err, count) {
          test.equal(10, count);
        });

        collection.find().limit(5).toArray(function(err, items) {
          test.equal(5, items.length);
          // Let's close the db
          test.done();
        });
      }
    );
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyHandleNegativeOneLimitOnCursor = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_cursor_negative_one_limit', function(err, collection) {
    Step(
      function insert() {
        var group = this.group();

        for(var i = 0; i < 10; i++) {
          collection.save({'x':1}, {w:1}, group());
        }
      },

      function finished() {
        collection.find().limit(-1).toArray(function(err, items) {
          test.equal(1, items.length);
          // Let's close the db
          test.done();
        });
      }
    );
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyHandleAnyNegativeLimitOnCursor = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_cursor_any_negative_limit', function(err, collection) {
    Step(
      function insert() {
        var group = this.group();

        for(var i = 0; i < 10; i++) {
          collection.save({'x':1}, {w:1}, group());
        }
      },

      function finished() {
        collection.find().limit(-5).toArray(function(err, items) {
          test.equal(5, items.length);
          // Let's close the db
          test.done();
        });
      }
    );
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyReturnErrorsOnIllegalLimitValues = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_limit_exceptions', function(err, collection) {
    collection.insert({'a':1}, {w:1}, function(err, docs) {});
    collection.find(function(err, cursor) {
      cursor.limit('not-an-integer', function(err, cursor) {
        test.equal("limit requires an integer", err.message);
      });

      try {
        cursor.limit('not-an-integer');
        test.ok(false);
      } catch(err) {
        test.equal("limit requires an integer", err.message);
      }
    });

    collection.find(function(err, cursor) {
      cursor.nextObject(function(err, doc) {
        cursor.limit(1, function(err, cursor) {
          test.equal("Cursor is closed", err.message);
        });

        try {
          cursor.limit(1);
          test.ok(false);
        } catch(err) {
          test.equal("Cursor is closed", err.message);
        }
      });
    });

    collection.find(function(err, cursor) {
      cursor.close(function(err, cursor) {
        cursor.limit(1, function(err, cursor) {
          test.equal("Cursor is closed", err.message);
          test.done();
        });

        try {
          cursor.limit(1);
          test.ok(false);
        } catch(err) {
          test.equal("Cursor is closed", err.message);
        }
      });
    });
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlySkipRecordsOnCursor = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_skip', function(err, collection) {
    Step(
      function insert() {
        var group = this.group();

        for(var i = 0; i < 10; i++) {
          collection.insert({'x':i}, {w:1}, group());
        }
      },

      function finished() {
        collection.find(function(err, cursor) {
          cursor.count(function(err, count) {
            test.equal(10, count);
          });
        });

        collection.find(function(err, cursor) {
          cursor.toArray(function(err, items) {
            test.equal(10, items.length);

            collection.find().skip(2).toArray(function(err, items2) {
              test.equal(8, items2.length);

              // Check that we have the same elements
              var numberEqual = 0;
              var sliced = items.slice(2, 10);

              for(var i = 0; i < sliced.length; i++) {
                if(sliced[i].x == items2[i].x) numberEqual = numberEqual + 1;
              }
              test.equal(8, numberEqual);

              // Let's close the db
              test.done();
            });
          });
        });
      }
    )
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyReturnErrorsOnIllegalSkipValues = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_skip_exceptions', function(err, collection) {
    collection.insert({'a':1}, {w:1}, function(err, docs) {});
    collection.find().skip('not-an-integer', function(err, cursor) {
      test.equal("skip requires an integer", err.message);
    });

    var cursor = collection.find()
    cursor.nextObject(function(err, doc) {
      cursor.skip(1, function(err, cursor) {
        test.equal("Cursor is closed", err.message);
      });
    });

    var cursor = collection.find()
    cursor.close(function(err, cursor) {
      cursor.skip(1, function(err, cursor) {
        test.equal("Cursor is closed", err.message);

        test.done();
      });
    });
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldReturnErrorsOnIllegalBatchSizes = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_batchSize_exceptions', function(err, collection) {
    collection.insert({'a':1}, {w:1}, function(err, docs) {});
    var cursor = collection.find();
    cursor.batchSize('not-an-integer', function(err, cursor) {
      test.equal("batchSize requires an integer", err.message);
    });

    try {
      cursor.batchSize('not-an-integer');
      test.ok(false);
    } catch (err) {
      test.equal("batchSize requires an integer", err.message);
    }

    var cursor = collection.find();
    cursor.nextObject(function(err, doc) {
      cursor.nextObject(function(err, doc) {
        cursor.batchSize(1, function(err, cursor) {
          test.equal("Cursor is closed", err.message);
        });

        try {
          cursor.batchSize(1);
          test.ok(false);
        } catch (err) {
          test.equal("Cursor is closed", err.message);
        }
      });
    });

    var cursor = collection.find()
    cursor.close(function(err, cursor) {
      cursor.batchSize(1, function(err, cursor) {
        test.equal("Cursor is closed", err.message);

        test.done();
      });

      try {
        cursor.batchSize(1);
        test.ok(false);
      } catch (err) {
        test.equal("Cursor is closed", err.message);
      }
    });
  });
}

/**
 * @ignore
 * @api private
 */
/* REASON: Batch size is not actually supported
exports.shouldCorrectlyHandleChangesInBatchSizes = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_not_multiple_batch_size', function(err, collection) {
    var records = 6;
    var batchSize = 2;
    var docs = [];
    for(var i = 0; i < records; i++) {
      docs.push({'a':i});
    }

    collection.insert(docs, {w:1}, function() {
      collection.find({}, {batchSize : batchSize}, function(err, cursor) {
        //1st
        cursor.nextObject(function(err, items) {
          //cursor.items should contain 1 since nextObject already popped one
          test.equal(1, cursor.items.length);
          test.ok(items != null);

          //2nd
          cursor.nextObject(function(err, items) {
            test.equal(0, cursor.items.length);
            test.ok(items != null);

            //test batch size modification on the fly
            batchSize = 3;
            cursor.batchSize(batchSize);

            //3rd
            cursor.nextObject(function(err, items) {
              test.equal(2, cursor.items.length);
              test.ok(items != null);

              //4th
              cursor.nextObject(function(err, items) {
                test.equal(1, cursor.items.length);
                test.ok(items != null);

                //5th
                cursor.nextObject(function(err, items) {
                  test.equal(0, cursor.items.length);
                  test.ok(items != null);

                  //6th
                  cursor.nextObject(function(err, items) {
                    test.equal(0, cursor.items.length);
                    test.ok(items != null);

                    //No more
                    cursor.nextObject(function(err, items) {
                      test.ok(items == null);
                      test.ok(cursor.isClosed());

                      test.done();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}*/

/**
 * @ignore
 * @api private
 */
/* REASON: Batch size is not supported
exports.shouldHandleWhenLimitBiggerThanBatchSize = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_limit_greater_than_batch_size', function(err, collection) {
    var limit = 4;
    var records = 10;
    var batchSize = 3;
    var docs = [];
    for(var i = 0; i < records; i++) {
      docs.push({'a':i});
    }

    collection.insert(docs, {w:1}, function() {
      var cursor = collection.find({}, {batchSize : batchSize, limit : limit});
      //1st
      cursor.nextObject(function(err, items) {
        test.equal(2, cursor.items.length);

        //2nd
        cursor.nextObject(function(err, items) {
          test.equal(1, cursor.items.length);

          //3rd
          cursor.nextObject(function(err, items) {
            test.equal(0, cursor.items.length);

            //4th
            cursor.nextObject(function(err, items) {
              test.equal(0, cursor.items.length);

              //No more
              cursor.nextObject(function(err, items) {
                test.ok(items == null);
                test.ok(cursor.isClosed());

                test.done();
              });
            });
          });
        });
      });
    });
  });
} */

/**
 * @ignore
 * @api private
 */
/* REASON: Batch size is not supported
exports.shouldHandleLimitLessThanBatchSize = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_limit_less_than_batch_size', function(err, collection) {
    var limit = 2;
    var records = 10;
    var batchSize = 4;
    var docs = [];
    for(var i = 0; i < records; i++) {
      docs.push({'a':i});
    }

    collection.insert(docs, {w:1}, function() {
      var cursor = collection.find({}, {batchSize : batchSize, limit : limit});
      //1st
      cursor.nextObject(function(err, items) {
        test.equal(1, cursor.items.length);

        //2nd
        cursor.nextObject(function(err, items) {
          test.equal(0, cursor.items.length);

          //No more
          cursor.nextObject(function(err, items) {
            test.ok(items == null);
            test.ok(cursor.isClosed());

            test.done();
          });
        });
      });
    });
  });
}
*/

/**
 * @ignore
 * @api private
 */
exports.shouldHandleSkipLimitChaining = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_limit_skip_chaining', function(err, collection) {
    Step(
      function insert() {
        var group = this.group();

        for(var i = 0; i < 10; i++) {
          collection.insert({'x':1}, {w:1}, group());
        }
      },

      function finished() {
        collection.find().toArray(function(err, items) {
          test.equal(10, items.length);

          collection.find().limit(5).skip(3).toArray(function(err, items2) {
            test.equal(5, items2.length);

            // Check that we have the same elements
            var numberEqual = 0;
            var sliced = items.slice(3, 8);

            for(var i = 0; i < sliced.length; i++) {
              if(sliced[i].x == items2[i].x) numberEqual = numberEqual + 1;
            }
            test.equal(5, numberEqual);

            // Let's close the db
            test.done();
          });
        });
      }
    )
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyHandleLimitSkipChainingInline = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_limit_skip_chaining_inline', function(err, collection) {
    Step(
      function insert() {
        var group = this.group();

        for(var i = 0; i < 10; i++) {
          collection.insert({'x':1}, {w:1}, group());
        }
      },

      function finished() {
        collection.find().toArray(function(err, items) {
          test.equal(10, items.length);

          collection.find().limit(5).skip(3).toArray(function(err, items2) {
            test.equal(5, items2.length);

            // Check that we have the same elements
            var numberEqual = 0;
            var sliced = items.slice(3, 8);

            for(var i = 0; i < sliced.length; i++) {
              if(sliced[i].x == items2[i].x) numberEqual = numberEqual + 1;
            }
            test.equal(5, numberEqual);

            // Let's close the db
            test.done();
          });
        });
      }
    )
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCloseCursorNoQuerySent = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_close_no_query_sent', function(err, collection) {
    collection.find().close(function(err, cursor) {
      test.equal(true, cursor.isClosed());
      // Let's close the db
      test.done();
    });
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyExecuteToArrayAndFailOnFurtherCursorAccess = function(configuration, test) {
  var client = configuration.db();

  client.createCollection('test_to_a', function(err, collection) {

    collection.insert({'a':1}, {w:1}, function(err, ids) {
      var cursor = collection.find({});
      cursor.toArray(function(err, items) {
        // Should fail if called again (cursor should be closed)
        cursor.toArray(function(err, items) {
          test.equal("Cursor is closed", err.message);

          // Should fail if called again (cursor should be closed)
          cursor.each(function(err, item) {
            test.equal("Cursor is closed", err.message);
            // Let's close the db
            test.done();
          });
        });
      });
    });
  });
}

/**
 * A simple example iterating over a query using the each function of the cursor.
 *
 * @_class cursor
 * @_function each
 * @ignore
 */
exports.shouldCorrectlyFailToArrayDueToFinishedEachOperation = function(configuration, test) {
  var db = configuration.newDbInstance({w:1}, {poolSize:1, auto_reconnect:false});

  // DOC_LINE var db = new Db('test', new Server('locahost', 27017));
  // DOC_START
  // Establish connection to db
  db.open(function(err, db) {

    // Create a collection
    db.createCollection('test_to_a_after_each', function(err, collection) {
      test.equal(null, err);

      // Insert a document in the collection
      collection.insert({'a':1}, {w:1}, function(err, ids) {

        // Grab a cursor
        var cursor = collection.find();

        // Execute the each command, triggers for each document
        cursor.each(function(err, item) {

          // If the item is null then the cursor is exhausted/empty and closed
          if(item == null) {

            // Show that the cursor is closed
            cursor.toArray(function(err, items) {
              test.ok(err != null);

              // Let's close the db
              test.done();
              db.close();
            });
          };
        });
      });
    });
  });
  // DOC_END
}

/**
 * @ignore
 * @api private
 */
/* REASON: Explain is not supported
exports.shouldCorrectlyExecuteCursorExplain = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_explain', function(err, collection) {
    collection.insert({'a':1}, {w:1}, function(err, r) {
      collection.find({'a':1}).explain(function(err, explaination) {
        test.ok(explaination.cursor != null);
        test.ok(explaination.n.constructor == Number);
        test.ok(explaination.millis.constructor == Number);
        test.ok(explaination.nscanned.constructor == Number);

        // Let's close the db
        test.done();
      });
    });
  });
}
*/

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyExecuteCursorCountWithFields = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_count_with_fields', function(err, collection) {
    collection.save({'x':1, 'a':2}, {w:1}, function(err, doc) {
      collection.find({}, {'fields':['a']}).toArray(function(err, items) {
        test.equal(1, items.length);
        test.equal(2, items[0].a);
        test.equal(null, items[0].x);
      });

      collection.findOne({}, {'fields':['a']}, function(err, item) {
        test.equal(2, item.a);
        test.equal(null, item.x);
        test.done();
      });
    });
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyCountWithFieldsUsingExclude = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('test_count_with_fields_using_exclude', function(err, collection) {
    collection.save({'x':1, 'a':2}, {w:1}, function(err, doc) {
      collection.find({}, {'fields':{'x':0}}).toArray(function(err, items) {
        test.equal(1, items.length);
        test.equal(2, items[0].a);
        test.equal(null, items[0].x);
        test.done();
      });
    });
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyExecuteEnsureIndexWithNoCallback = function(configuration, test) {
  var docs = [];

  for(var i = 0; i < 1; i++) {
    var d = new Date().getTime() + i*1000;
    docs[i] = {createdAt:new Date(d)};
  }

  var client = configuration.db();
  // Create collection
  client.createCollection('shouldCorrectlyExecuteEnsureIndexWithNoCallback', function(err, collection) {
    // ensure index of createdAt index
    collection.ensureIndex({createdAt:1})
    // insert all docs
    collection.insert(docs, {w:1}, function(err, result) {
      test.equal(null, err);

      // Find with sort
      collection.find().sort(['createdAt', 'asc']).toArray(function(err, items) {
        if (err) logger.error("error in collection_info.find: " + err);
        test.equal(1, items.length);
        test.done();
      })
    })
  });
}

/**
 * @ignore
 * @api private
 */
exports.shouldCorrectlyInsert5000RecordsWithDateAndSortCorrectlyWithIndex = function(configuration, test) {
  var docs = [];

  for(var i = 0; i < 5000; i++) {
    var d = new Date().getTime() + i*1000;
    docs[i] = {createdAt:new Date(d)};
  }

  var client = configuration.db();
  // Create collection
  client.createCollection('shouldCorrectlyInsert5000RecordsWithDateAndSortCorrectlyWithIndex', function(err, collection) {
    // ensure index of createdAt index
    collection.ensureIndex({createdAt:1}, function(err, indexName) {
      test.equal(null, err);

      // insert all docs
      collection.insert(docs, {w:1}, function(err, result) {
        test.equal(null, err);

        // Find with sort
        collection.find().sort(['createdAt', 'asc']).toArray(function(err, items) {
          if (err) logger.error("error in collection_info.find: " + err);
          test.equal(5000, items.length);
          test.done();
        })
      })
    });
  });
}

/**
 * An example showing the information returned by indexInformation
 *
 * @_class cursor
 * @_function rewind
 */
/* REASON: IndexInformation is not supported
exports['Should correctly rewind and restart cursor'] = function(configuration, test) {
  var db = configuration.newDbInstance({w:1}, {poolSize:1, auto_reconnect:false});

  // DOC_LINE var db = new Db('test', new Server('locahost', 27017));
  // DOC_START
  // Establish connection to db
  db.open(function(err, db) {
    var docs = [];

    // Insert 100 documents with some data
    for(var i = 0; i < 100; i++) {
      var d = new Date().getTime() + i*1000;
      docs[i] = {'a':i, createdAt:new Date(d)};
    }

    // Create collection
    db.createCollection('Should_correctly_rewind_and_restart_cursor', function(err, collection) {
      test.equal(null, err);

      // insert all docs
      collection.insert(docs, {w:1}, function(err, result) {
        test.equal(null, err);

        // Grab a cursor using the find
        var cursor = collection.find({});
        // Fetch the first object off the cursor
        cursor.nextObject(function(err, item) {
          test.equal(0, item.a)
          // Rewind the cursor, resetting it to point to the start of the query
          cursor.rewind();

          // Grab the first object again
          cursor.nextObject(function(err, item) {
            test.equal(0, item.a)

            db.close();
            test.done();
          })
        })
      })
    });
  });
  // DOC_END
}
*/

/**
 * @ignore
 * @api private
 */
exports['Should correctly execute count on cursor'] = function(configuration, test) {
  var docs = [];

  for(var i = 0; i < 1000; i++) {
    var d = new Date().getTime() + i*1000;
    docs[i] = {'a':i, createdAt:new Date(d)};
  }

  var client = configuration.db();
  // Create collection
  client.createCollection('Should_correctly_execute_count_on_cursor', function(err, collection) {
    test.equal(null, err);

    // insert all docs
    collection.insert(docs, {w:1}, function(err, result) {
      test.equal(null, err);
      var total = 0;
      // Create a cursor for the content
      var cursor = collection.find({});
      cursor.count(function(err, c) {
        // Ensure each returns all documents
        cursor.each(function(err, item) {
          if(item != null) {
            total++;
          } else {
            cursor.count(function(err, c) {
              test.equal(1000, c);
              test.equal(1000, total);
              test.done();
            })
          }
        });
      })
    })
  });
}


/**
 * @ignore
 * @api private
 */
/* REASON: Cursor stream is not supported
exports['should be able to stream documents'] = function(configuration, test) {
  var docs = [];

  for (var i = 0; i < 1000; i++) {
    docs[i] = { a: i+1 };
  }

  var client = configuration.db();
  // Create collection
  client.createCollection('Should_be_able_to_stream_documents', function(err, collection) {
    test.equal(null, err);

    // insert all docs
    collection.insert(docs, {w:1}, function(err, result) {
      test.equal(null, err);

      var paused = 0
        , closed = 0
        , resumed = 0
        , i = 0
        , err

      var stream = collection.find().stream();

      stream.on('data', function (doc) {
        test.equal(true, !! doc);
        test.equal(true, !! doc.a);

        if (paused > 0 && 0 === resumed) {
          err = new Error('data emitted during pause');
          return done();
        }

        if (++i === 3) {
          test.equal(false, stream.paused);
          stream.pause();
          test.equal(true, stream.paused);
          paused++;

          setTimeout(function () {
            test.equal(true, stream.paused);
            stream.resume();
            process.nextTick(function() {
              test.equal(false, stream.paused);
              resumed++;
            })
          }, 20);
        }
      });

      stream.on('error', function (er) {
        err = er;
        done();
      });

      stream.on('close', function () {
        closed++;
        done();
      });

      function done () {
        test.equal(undefined, err);
        test.equal(i, docs.length);
        test.equal(1, closed);
        test.equal(1, paused);
        test.equal(1, resumed);
        test.strictEqual(stream._cursor.isClosed(), true);
        test.done();
      }
    })
  })
}*/

/**
 * @ignore
 * @api private
 */
/* REASON: Cursor stream is not supported 
exports['immediately destroying a stream prevents the query from executing'] = function(configuration, test) {
  var i = 0
    , docs = [{ b: 2 }, { b: 3 }]
    , doneCalled = 0

  var client = configuration.db();
  client.createCollection('immediately_destroying_a_stream_prevents_the_query_from_executing', function(err, collection) {
    test.equal(null, err);

    // insert all docs
    collection.insert(docs, {w:1}, function(err, result) {
      test.equal(null, err);

      var stream = collection.find().stream();

      stream.on('data', function () {
        i++;
      })
      stream.on('close', done);
      stream.on('error', done);

      stream.destroy();

      function done (err) {
        test.equal(++doneCalled, 1);
        test.equal(undefined, err);
        test.strictEqual(0, i);
        test.strictEqual(true, stream._destroyed);
        test.done();
      }
    });
  });
}*/

/**
 * @ignore
 * @api private
 */
/* REASON: Cursor stream is not supported
exports['destroying a stream stops it'] = function(configuration, test) {
  var client = configuration.db();
  client.createCollection('destroying_a_stream_stops_it', function(err, collection) {
    test.equal(null, err);

    var docs = [];
    for (var ii = 0; ii < 10; ++ii) docs.push({ b: ii+1 });

    var client = configuration.db();
    // insert all docs
    collection.insert(docs, {w:1}, function(err, result) {
      test.equal(null, err);

      var finished = 0
        , i = 0

      var stream = collection.find().stream();

      test.strictEqual(null, stream._destroyed);
      test.strictEqual(true, stream.readable);

      stream.on('data', function (doc) {
        if (++i === 5) {
          stream.destroy();
          test.strictEqual(false, stream.readable);
        }
      });

      stream.on('close', done);
      stream.on('error', done);

      function done (err) {
        ++finished;
        setTimeout(function () {
          test.strictEqual(undefined, err);
          test.strictEqual(5, i);
          test.strictEqual(1, finished);
          test.strictEqual(true, stream._destroyed);
          test.strictEqual(false, stream.readable);
          test.strictEqual(true, stream._cursor.isClosed());
          test.done();
        }, 150)
      }
    });
  });
} */

/**
 * @ignore
 * @api private
 */
/* REASON: Cursor stream is not supported 
exports['cursor stream errors']= function(configuration, test) {
  if(configuration.db().serverConfig instanceof configuration.getMongoPackage().ReplSet) return test.done();
  var client = configuration.newDbInstance({w:1}, {poolSize:1, auto_reconnect:false});
  client.open(function(err, db_p) {
    test.equal(null, err);

    client.createCollection('cursor_stream_errors', function(err, collection) {
      test.equal(null, err);

      var docs = [];
      for (var ii = 0; ii < 10; ++ii) docs.push({ b: ii+1 });

      // insert all docs
      collection.insert(docs, {w:1}, function(err, result) {
        test.equal(null, err);

        var finished = 0
          , closed = 0
          , i = 0

        var stream = collection.find({}, { batchSize: 5 }).stream();

        stream.on('data', function (doc) {
          if (++i === 5) {
            client.close();
          }
        });

        stream.on('close', function () {
          closed++;
        });

        stream.on('error', done);

        function done (err) {
          ++finished;
          setTimeout(function () {
            test.equal('no open connections', err.message);
            test.equal(5, i);
            test.equal(1, closed);
            test.equal(1, finished);
            test.equal(true, stream._destroyed);
            test.equal(false, stream.readable);
            test.equal(true, stream._cursor.isClosed());
            test.done();
          }, 150)
        }
      });
    });
  });
}*/

/**
 * @ignore
 * @api private
 */
/* REASON: Cursor stream is not supported
exports['cursor stream pipe']= function(configuration, test) {
  var client = configuration.db();
  client.createCollection('cursor_stream_pipe', function(err, collection) {
    test.equal(null, err);

    var docs = [];
    ;('Aaden Aaron Adrian Aditya Bob Joe').split(' ').forEach(function (name) {
      docs.push({ name: name });
    });

    // insert all docs
    collection.insert(docs, {w:1}, function(err, result) {
      test.equal(null, err);

      var filename = '/tmp/_nodemongodbnative_stream_out.txt'
        , out = fs.createWriteStream(filename)

      // hack so we don't need to create a stream filter just to
      // stringify the objects (otherwise the created file would
      // just contain a bunch of [object Object])
      // var toString = Object.prototype.toString;
      // Object.prototype.toString = function () {
      //   return JSON.stringify(this);
      // }

      var stream = collection.find().stream({transform: function(doc) { return JSON.stringify(doc); }});
      stream.pipe(out);
      // Wait for output stream to close
      out.on('close', done);

      function done (err) {
        // Object.prototype.toString = toString;
        test.strictEqual(undefined, err);
        var contents = fs.readFileSync(filename, 'utf8');
        test.ok(/Aaden/.test(contents));
        test.ok(/Aaron/.test(contents));
        test.ok(/Adrian/.test(contents));
        test.ok(/Aditya/.test(contents));
        test.ok(/Bob/.test(contents));
        test.ok(/Joe/.test(contents));
        fs.unlink(filename);
        test.done();
      }
    });
  });
}*/

/**
 * A simple example showing the count function of the cursor.
 *
 * @_class cursor
 * @_function count
 * @ignore
 */
exports.shouldCorrectlyUseCursorCountFunction = function(configuration, test) {
  var db = configuration.newDbInstance({w:1}, {poolSize:1, auto_reconnect:false});

  // DOC_LINE var db = new Db('test', new Server('locahost', 27017));
  // DOC_START
  // Establish connection to db
  db.open(function(err, db) {

    // Creat collection
    db.createCollection('cursor_count_collection', function(err, collection) {
      test.equal(null, err);

      // Insert some docs
      collection.insert([{a:1}, {a:2}], {w:1}, function(err, docs) {
        test.equal(null, err);

        // Do a find and get the cursor count
        collection.find().count(function(err, count) {
          test.equal(null, err);
          test.equal(2, count);

          db.close();
          test.done();
        })
      });
    });
  });
  // DOC_END
}

/**
 * A simple example showing the use of sort on the cursor.
 *
 * @_class cursor
 * @_function sort
 * @ignore
 */
exports.shouldCorrectlyPeformSimpleSorts = function(configuration, test) {
  var db = configuration.newDbInstance({w:1}, {poolSize:1, auto_reconnect:false});

  // DOC_LINE var db = new Db('test', new Server('locahost', 27017));
  // DOC_START
  // Establish connection to db
  db.open(function(err, db) {

    // Create a collection
    db.createCollection('simple_sort_collection', function(err, collection) {
      test.equal(null, err);

      // Insert some documents we can sort on
      collection.insert([{a:1}, {a:2}, {a:3}], {w:1}, function(err, docs) {
        test.equal(null, err);

        // Do normal ascending sort
        collection.find().sort([['a', 1]]).nextObject(function(err, item) {
          test.equal(null, err);
          test.equal(1, item.a);

          // Do normal descending sort
          collection.find().sort([['a', -1]]).nextObject(function(err, item) {
            test.equal(null, err);
//            test.equal(3, item.a);

            db.close();
            test.done();
          });
        });
      });
    });
  });
  // DOC_END
}

/**
 * A simple example showing the use of limit on the cursor
 *
 * @_class cursor
 * @_function limit
 * @ignore
 */
exports.shouldCorrectlyPeformLimitOnCursor = function(configuration, test) {
  var db = configuration.newDbInstance({w:1}, {poolSize:1, auto_reconnect:false});

  // DOC_LINE var db = new Db('test', new Server('locahost', 27017));
  // DOC_START
  // Establish connection to db
  db.open(function(err, db) {

    // Create a collection
    db.createCollection('simple_limit_collection', function(err, collection) {
      test.equal(null, err);

      // Insert some documents we can sort on
      collection.insert([{a:1}, {a:2}, {a:3}], {w:1}, function(err, docs) {
        test.equal(null, err);

        // Limit to only one document returned
        collection.find().limit(1).toArray(function(err, items) {
          test.equal(null, err);
          test.equal(1, items.length);

          db.close();
          test.done();
        });
      });
    });
  });
  // DOC_END
}

/**
 * A simple example showing the use of skip on the cursor
 *
 * @_class cursor
 * @_function skip
 * @ignore
 */
exports.shouldCorrectlyPeformSkipOnCursor = function(configuration, test) {
  var db = configuration.newDbInstance({w:1}, {poolSize:1, auto_reconnect:false});

  // DOC_LINE var db = new Db('test', new Server('locahost', 27017));
  // DOC_START
  // Establish connection to db
  db.open(function(err, db) {

    // Create a collection
    db.createCollection('simple_skip_collection', function(err, collection) {
      test.equal(null, err);

      // Insert some documents we can sort on
      collection.insert([{a:1}, {a:2}, {a:3}], {w:1}, function(err, docs) {
        test.equal(null, err);

        // Skip one document
        collection.find().skip(1).nextObject(function(err, item) {
          test.equal(null, err);
          test.equal(2, item.a);

          db.close();
          test.done();
        });
      });
    });
  });
  // DOC_END
}



