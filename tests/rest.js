require('colors');
require('sugar');
var server = require('../');
var should = require('should'); 
var assert = require('assert');
var request = require('supertest');
var assert = require('assert');

var get_subject = 'Test'.cyan + ' → '.grey + 'REST GET'.yellow + ': '.grey;
var post_subject = 'Test'.cyan + ' → '.grey + 'REST POST'.yellow + ': '.grey;
var put_subject = 'Test'.cyan + ' → '.grey + 'REST PUT'.yellow + ': '.grey;

var app = new server({debug: false});
app.domain('http://localhost:9044/');
app.start(function() {

    describe(put_subject + 'Test REST Request/Response', function () {
        
        describe('$.error()', function () {
            it('should respond with json ({passed: false, {errors: {"204": "No Content"}}) and 204', function(done) {
                
        		app.put('/api/newuser/12', function ($) {
                    if (!$.body) {
                        $.error(200, {"204":"No Content"}); // Bug if sends a 204
                    } else {
                        $.header('location', '/api/newuser/12');
                        $.success();
                    }
        		});
                
    			
    			request('http://localhost:9044')
    				.put('/api/newuser/12')
                    .send()
    				.set('Content-Type', 'application/json; charset=utf-8')
    				.expect(200) // Not Content
    				.end(function(err,res) {
    					if (err) {
    						throw err;
    					}
    					res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
    					assert.deepEqual(res.body, {passed: false, errors: {"204": "No Content"}});
    					res.body.should.eql({passed: false, errors: {"204": "No Content"}});
    			    });
                
        			request('http://localhost:9044')
        				.put('/api/newuser/12')
                        .send({id: 1, name: "joe"})
        				.set('Content-Type', 'application/json; charset=utf-8')
        				.expect(200) // Created
        				.end(function(err,res) {
        					if (err) {
        						throw err;
        					}
        					res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
                            res.headers.should.have.property('location', '/api/newuser/12');
        					assert.deepEqual(res.body, {"passed":true});
        					res.body.should.eql({"passed":true});
        					done();
        			});
                
            });
        });
        
        describe('$.json(object)', function () {
            
    		it('should respond with json ({id: 1, name="joe2"}) and 200 (Updated)', function(done) {

        		app.put('/api/newuser/1', function ($) {
                    $.header('location', '/api/newuser/1');
                    $.body.name = "joe2";
        			$.json($.body);
        		});
            
    			request('http://localhost:9044')
    				.put('/api/newuser/1')
                    .send({id: 1, name: "joe"})
    				.set('Content-Type', 'application/json; charset=utf-8')
    				.expect(200) // Created
    				.end(function(err,res) {
    					if (err) {
    						throw err;
    					}
    					res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
                        res.headers.should.have.property('location', '/api/newuser/1');
    					assert.deepEqual(res.body, {id: 1, name: "joe2"});
    					res.body.should.eql({id: 1, name: "joe2"});
    					done();
    			});
    		});
        });
    });
    
    describe(post_subject + 'Test REST Request/Response', function () {
        
        describe('$.error()', function () {
            
            it('should respond with json implicit ({passed: false, errors:{"404": "Not found"}})'.grey, function (done) {
		
        		app.post('/api/notpostfound', function ($) {
                    //$.errors['404'] = "Not found";
                    $.error(404, {'404': "Not found"});
        		});
		
    			request('http://localhost:9044')
    				.post('/api/notpostfound')
    				.set('Content-Type', 'application/json; charset=utf-8')
    				.expect(404)
    				.end(function(err,res) {
    					if (err) {
    						throw err;
    					}
    					res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
    					assert.deepEqual(res.body, {passed: false, errors:{"404": "Not found"}});
    					res.body.should.eql({passed: false, errors:{"404": "Not found"}});
    					done();
				});
        	});
            
            it('should respond with json explicit ({passed: false, errors:{"404": "Not found"}})'.grey, function (done) {
		
        		app.post('/api/notpostfound2', function ($) {
                    $.errors['404'] = "Not found";
                    $.error(404);
        		});
		
    			request('http://localhost:9044')
    				.post('/api/notpostfound2')
    				.set('Content-Type', 'application/json; charset=utf-8')
    				.expect(404)
    				.end(function(err,res) {
    					if (err) {
    						throw err;
    					}
    					res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
    					assert.deepEqual(res.body, {passed: false, errors:{"404": "Not found"}});
    					res.body.should.eql({passed: false, errors:{"404": "Not found"}});
    					done();
				});

        	});
            
        });
        
        describe('$.json(object)', function () {

    		it('should respond with json ({id: 1, name="joe"}) and 201 (Created)', function(done) {

        		app.post('/jsonapi/newuser', function ($) {
                    $.header('location', '/jsonapi/newuser/1');
        			$.json($.body);
        		});
                
    			request('http://localhost:9044')
    				.post('/jsonapi/newuser')
                    .send({id: 1, name: "joe"})
    				.set('Content-Type', 'application/json; charset=utf-8')
    				.expect(201) // Created
    				.end(function(err,res) {
    					if (err) {
    						throw err;
    					}
    					res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
                        res.headers.should.have.property('location', '/jsonapi/newuser/1');
    					assert.deepEqual(res.body, {id: 1, name: "joe"});
    					res.body.should.eql({id: 1, name: "joe"});
    					done();
				});
    		});
        
        });


        describe('$.success()', function () {

    		it('should respond with json ({passed: true}) and 201 (Created)', function(done) {

        		app.post('/api/newdata', function ($) {
                    $.header('location', '/api/newdata/1');
        			$.success();
        		});
                
    			request('http://localhost:9044')
    				.post('/api/newdata')
    				.set('Content-Type', 'application/json; charset=utf-8')
    				.expect(201) // Created
    				.end(function(err,res) {
    					if (err) {
    						throw err;
    					}
    					res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
                        res.headers.should.have.property('location', '/api/newdata/1');
    					assert.deepEqual(res.body, {"passed":true});
    					res.body.should.eql({"passed":true});
    					done();
				});
    		});
            
            it('should respond with json ({id: 1, name: "joe"}) and 201 (Created)'.grey, function (done) {
	
        		app.post('/api/newuser', function ($) {
                    $.header('location', '/api/newuser/' + $.body.id);
        			$.success();
        		});
	            
    			request('http://localhost:9044')
    				.post('/api/newuser')
                .send({id: 1, name: "joe"})
    				.set('Content-Type', 'application/json; charset=utf-8')
    				.expect(201) // Created
    				.end(function(err,res) {
    					if (err) {
    						throw err;
    					}
    					res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
                        res.headers.should.have.property('location', '/api/newuser/1');
    					assert.deepEqual(res.body, {"passed":true});
    					res.body.should.eql({"passed":true});
    					done();
    				});
        	});

        });
    });
    
    describe(get_subject + 'Test REST Request/Response', function () {

        describe('$.error(object)', function () {

        	describe('response JSON when given primitives', function () {
        		it('should respond with json ({passed: false, errors: {}})', function(done) {
        			app.get('/api/noimplemented', function($) {
        				$.error(501);
        			});

        			request('http://localhost:9044')
        				.get('/api/noimplemented')
        				.set('Content-Type', 'application/json; charset=utf-8')
        				.expect(501)
        				.end(function(err,res) {
        					if (err) {
        						throw err;
        					}
        					res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
        					assert.deepEqual(res.body, {passed: false, errors: {}});
        					res.body.should.eql({passed: false, errors: {}});
        					done();
        				});
        		});
	    
        		it('should respond with json ({passed: false, errors: {error: "Can\'t get resource"}})', function(done) {

        			app.get('/api/data/-13', function($) {
        				$.error(500, {error: "Can't get resource"});
        			});

        			request('http://localhost:9044')
        				.get('/api/data/-13')
        				.set('Content-Type', 'application/json; charset=utf-8')
        				.expect(500)
        				.end(function(err,res) {
        					if (err) {
        						throw err;
        					}
        					res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
        					assert.deepEqual(res.body, {passed: false, errors: {error: "Can't get resource"}});
        					res.body.should.eql({passed: false, errors: {error: "Can't get resource"}});
        					done();
        				});
        		});
	
        		it('should respond with json ({passed: false, errors: {error: "Unexpeted input"}})', function(done) {

        			app.get('/api/data/-11', function($) {
        				$.error(500, {error: "Unexpeted input"});
        			});

        			request('http://localhost:9044')
        				.get('/api/data/-11')
        				.set('Content-Type', 'application/json; charset=utf-8')
        				.expect(500)
        				.end(function(err,res) {
        					if (err) {
        						throw err;
        					}
        					res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
        					assert.deepEqual(res.body, {passed: false, errors: {error: "Unexpeted input"}});
        					res.body.should.eql({passed: false, errors: {error: "Unexpeted input"}});
        					done();
        				});
        		});
        
                it('should respond with json ({passed: false, errors: {404: "Not found"}})'.grey, function (done) {
            		app.get('/api/data/-1', function ($) {
            			$.error(404, {"404": "Not found"});
            		});

        			request('http://localhost:9044')
        				.get('/api/data/-1')
        				.set('Content-Type', 'application/json; charset=utf-8')
        				.expect(404)
        				.end(function(err,res) {
        					if (err) {
        						throw err;
        					}
                            res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
        					assert.deepEqual(res.body, {passed: false, errors: {"404": "Not found"}});
        					res.body.should.eql({passed: false, errors: {"404": "Not found"}});
                            done();
                        });
            	});
                
                it('should respond with plain text when not found GET route'.grey, function (done) {

        			request('http://localhost:9044')
        				.get('/api/notfound')
                        .set('Content-Type', 'application/json; charset=utf-8')
        				.expect(404)
        				.end(function(err,res) {
        					if (err) {
        						throw err;
        					}
                            res.headers.should.have.property('content-type', 'text/plain');
        					assert.deepEqual(res.text, "404 Page not found.");
        					res.text.should.eql("404 Page not found.");
                            done();
                        });
            	});
                
        	});
        });
    });
	
    describe('$.json(object)', function () {
    
    	describe('response JSON when given primitives', function () {
    		it('should respond with json ({})', function(done) {

    			app.get('/api/data/0', function($) {
    				$.json(null);
    			});

    			request('http://localhost:9044')
    				.get('/api/data/0')
    				.set('Content-Type', 'application/json; charset=utf-8')
    				.expect(200)
    				.end(function(err,res) {
    					if (err) {
    						throw err;
    					}
    					res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
    					assert.deepEqual(res.body, {});
    					res.body.should.eql({});
    					done();
    				});
    		});

    		it('should respond with json ({message:"Hello World!"})', function(done) {
    			app.get('/api/data/1', function($) {
    				$.json({
    					message: 'Hello World!'
    				});
    			});

    			request('http://localhost:9044')
    				.get('/api/data/1')
    				.set('Content-Type', 'application/json; charset=utf-8')
    				.expect(200)
    				.expect('Content-Type', /json/)
    				.end(function(err,res) {
    					if (err) {
    						throw err;
    					}
    					res.body.should.eql({message:"Hello World!"});
    					res.body.should.have.property('message');
    					done();
    				});
    		});
	
    		it('should respond with json ([{message:"Hello World!"}])', function(done) {
		
    			app.get('/api/data', function($) {
    				$.json([
    					{message: 'Hello World!'}
    				]);
    			});

    			request('http://localhost:9044')
    				.get('/api/data')
    				.set('Content-Type', 'application/json; charset=utf-8')
    				.expect(200)
    				.expect('Content-Type', /json/)
    				.end(function(err,res) {
    					if (err) {
    						throw err;
    					}
    					res.body.should.eql([{message:"Hello World!"}]);
    					res.body.should.be.instanceof(Array).and.have.lengthOf(1);
    					res.body[0].should.have.property('message');
    					done();
    				});
    		});
	
    		it('should respond with 401 when unauthorized', function(done) {

    			app.get('/api/secure', function($) {
    				$.passed = false;
    				$.errors['401'] = 'Unauthorized';
    				$.json(null);
    			});

    			request('http://localhost:9044')
    				.get('/api/secure')
    				.set('Content-Type', 'application/json; charset=utf-8')
    				.expect(401)
    				.end(function(err,res) {
    					if (err) {
    						throw err;
    					}
    					res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
    					assert.deepEqual(res.body, {passed: false, errors: {401: "Unauthorized"}});
    					res.body.should.eql({passed: false, errors: {401: "Unauthorized"}});
    					done();
    				});
    		});
	
    	});
    });

    describe('$.json(object, status)', function () {
    	it('should respond with json and set the .statusCode', function(done){
    		app.get('/api/data/2', function($) {
    				$.json([
    					{message: 'Hello World!'}
    				], 201);
    			});

    		request('http://localhost:9044')
    			.get('/api/data/2')
    			.set('Content-Type', 'application/json; charset=utf-8')
    			.expect(201)
    			.expect('Content-Type', /json/)
    			.end(function(err,res) {
    				if (err) {
    					throw err;
    				}
    				res.statusCode.should.equal(201);
    				res.headers.should.have.property('content-type', 'application/json; charset=utf-8');
    				res.body.should.eql([{message:"Hello World!"}]);
    				done();
    			});
    	});

    });

});