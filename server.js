var express = require("express");
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
var validator = require("validator");
var jwt = require("jsonwebtoken");
var _ = require("lodash");
var bcryptjs = require("bcryptjs");

const port = process.env.PORT || 3000;

var app = express();

app.use(bodyParser.json());

mongoose.connect("mongodb://localhost:27017/todoapp");
mongoose.Promise = global.Promise;

//user model
/*{
	email: "",
	password: "",
	tokens: [
		{
			access: "",
			token: ""
		}
	]
}*/
var TodoSchema = new mongoose.Schema({
	title: {
		type: String,
		required: true,
	},
	content: {
		type: String,
		required: true
	},
	_creator_id: {
		type: mongoose.Schema.Types.ObjectId,
		required: true
	}
});

var Todo = mongoose.model("Todo", TodoSchema);



var UserSchema = new mongoose.Schema({
	email: {
		type: String,
		required: true,
		minlength: 1,
		trim: true,
		unique: true,
		validate: {
			validator: function(v){
				return validator.isEmail(v);
			},
			message: "Email is not valid"
		}
	},
	password: {
		type: String,
		required: true,
		minlength: 6
	},
	tokens: [
		{
			access: {
				type: String,
				required: true
			},
			token: {
				type: String,
				required: true
			}
		}
	]
});
UserSchema.methods.generateAuthToken = function(){
	var UserDocument = this;
	var access = "auth";
	var token = jwt.sign({ _id: UserDocument._id.toHexString() }, "sandip").toString();
	UserDocument.tokens.push({ access: access, token: token });
	return UserDocument.save().then(function(){
		return token;
	});
}
UserSchema.methods.toJSON = function(){
	var UserDocument = this;
	return _.pick(UserDocument, ['email', '_id']);
}
UserSchema.statics.getUserByToken = function(token){
	var UserModel = this;
	var decoded;
	try{
		decoded = jwt.verify(token, "sandip");
	}
	catch(e){
		return new Promise(function(resolve, reject){
			reject();
		});
	}
	
	return UserModel.findOne({ _id: decoded._id });
}
UserSchema.methods.deleteToken = function(token){
	var UserDocument = this;
	return UserDocument.update({
		$pull: {
			tokens:{
				token: token
			}
		}
	});

}
UserSchema.statics.getUserByCredential = function(email, password){
	var UserModel = this;
	return UserModel.findOne({ email: email }).then(function(result){
		if(!result){
			return new Promise(function(resolve, reject){
				reject();
			});
		}
		return new Promise(function(resolve, reject){
			bcryptjs.compare(password, result.password, function(error,response){
				
				if(response){
					resolve(result);
				}
				else{
					reject();
				}
			});
		});
		
	});
}

UserSchema.pre("save", function(next){
	var UserDocument = this;
	if(UserDocument.isModified("password")){
		bcryptjs.genSalt(10, function(error, salt){
			bcryptjs.hash(UserDocument.password, salt, function(error, hash){
				UserDocument.password = hash;
				next();
			})
		});
	}
	else{
		next();
	}
});


var User = mongoose.model("User", UserSchema);

var authentication = function(req, res, next){
	var token = req.header("x-auth");
	User.getUserByToken(token).then(function(user){
		req.userData = user;
		req.token = token;
		next();
	}).catch(function(error){
		res.status(401).send();
	});
}

app.post("/users", function(req, res){
	//console.log(req.body);
	var newUser = new User(req.body);
	newUser.save().then(function(result){
		return newUser.generateAuthToken();
	}).then(function(token){
		res.header("x-auth", token).send(newUser);
	}).catch(function(e){
		res.send(e);
	});
});

app.get("/users/me", authentication, function(req, res){
	
	res.send(req.userData);
	
});

app.post("/users/login", function(req, res){
	User.getUserByCredential(req.body.email, req.body.password).then(function(r){
		r.generateAuthToken().then(function(token){
			res.header("x-auth", token).send(r);
		});
		
	}).catch(function(e){
		res.status(401).send();
	});
});

app.delete("/users/me/token", authentication, function(req, res){
	req.userData.deleteToken(req.token).then(function(){
		res.status(200).send();
	}).catch(function(e){
		res.status(400).send();
	});
});

app.post("/todos", authentication, function(req, res){
	//console.log(req.body);
	var newTodo = new Todo({ title: req.body.title, content: req.body.content, _creator_id:req.userData._id });
	newTodo.save().then(function(r){
		res.status(200).send();
	}).catch(function(e){
		res.status(400).send();
	});
});

app.get("/todos/:id", authentication, function(req, res){
	Todo.findById(req.params.id).then(function(todos){
		res.send(todos);
	}, function(e){
		res.send(e);
	});
})


app.delete("/todos/:id", authentication, function(req, res){
	Todo.findByIdAndremove({ _id: req.params.id, _creator_id: req.userData._id }).then(function(todos){
		res.send(todos);
	}, function(e){
		res.send(e);
	});
});

app.patch("/todos/:id", authentication, function(req, res){

	Todo.update({ _id: req.params.id }, { title: "deep mandal" }, {new: true}).then(function(r){
		res.send(r);
	}).catch(function(e){
		res.send(e);
	});
})

var Person = {
	fname: "sandip"
};
var {fname} = Person;
console.log(fname);

app.listen(port, function(){
	console.log("Server running Heroku");
});